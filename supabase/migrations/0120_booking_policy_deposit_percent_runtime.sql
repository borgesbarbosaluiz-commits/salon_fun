create or replace function public.resolve_salon_booking_policy_deposit_details(
  salon_uuid uuid,
  service_price_input numeric
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  configured_salon public.salons;
  client_config jsonb := '{}'::jsonb;
  deposit_percent_text text;
  deposit_percent numeric(10, 2) := null;
  normalized_service_price numeric(10, 2) := greatest(coalesce(service_price_input, 0), 0);
  effective_amount numeric(10, 2) := 0;
begin
  select *
  into configured_salon
  from public.salons
  where id = salon_uuid
  limit 1;

  if configured_salon.id is null or not configured_salon.booking_policy_requires_deposit then
    return jsonb_build_object(
      'amount', 0,
      'label', '0.00',
      'mode', 'none',
      'percent', null
    );
  end if;

  if coalesce(configured_salon.booking_policy_deposit_amount, 0) > 0 then
    effective_amount := round(configured_salon.booking_policy_deposit_amount::numeric, 2);
    return jsonb_build_object(
      'amount', effective_amount,
      'label', to_char(effective_amount, 'FM999999990.00'),
      'mode', 'fixed',
      'percent', null
    );
  end if;

  client_config := coalesce(configured_salon.client_app_config, '{}'::jsonb);
  deposit_percent_text := nullif(btrim(coalesce(client_config ->> 'depositPercent', '')), '');

  if deposit_percent_text is null or deposit_percent_text !~ '^[0-9]+([.][0-9]+)?$' then
    return jsonb_build_object(
      'amount', 0,
      'label', '0.00',
      'mode', 'none',
      'percent', null
    );
  end if;

  deposit_percent := least(greatest(deposit_percent_text::numeric, 0), 100);

  if deposit_percent <= 0 or normalized_service_price <= 0 then
    return jsonb_build_object(
      'amount', 0,
      'label', '0.00',
      'mode', 'none',
      'percent', deposit_percent
    );
  end if;

  effective_amount := round((normalized_service_price * deposit_percent / 100.0)::numeric, 2);

  return jsonb_build_object(
    'amount', effective_amount,
    'label',
    to_char(effective_amount, 'FM999999990.00')
      || ' ('
      || trim(to_char(deposit_percent, 'FM999999990.##'))
      || '% do servico)',
    'mode', 'percentage',
    'percent', deposit_percent
  );
end;
$$;

create or replace function public.create_appointment(
  service_uuid uuid,
  requested_date timestamptz,
  preferred_staff_member_uuid uuid default null,
  booking_policy_version_input text default null,
  payment_preference_input text default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_profile public.customers;
  selected_service public.services;
  configured_salon public.salons;
  created_appointment public.appointments;
  requested_end timestamptz;
  local_requested_day date;
  schedule record;
  requested_salon_timezone text;
  resolved_staff_member_id uuid;
  preferred_staff_valid boolean;
  normalized_booking_policy_input text := nullif(btrim(coalesce(booking_policy_version_input, '')), '');
  normalized_payment_preference text := nullif(btrim(coalesce(payment_preference_input, '')), '');
  effective_booking_policy_version text := null;
  effective_booking_policy_snapshot text := null;
  effective_booking_policy_acknowledged_at timestamptz := null;
  effective_deposit_amount numeric(10, 2) := 0;
  effective_deposit_label text := '0.00';
  effective_deposit_status text := 'not_required';
  effective_protection_auto_cancel_unconfirmed boolean := false;
  effective_protection_auto_cancel_pending_deposit boolean := false;
  effective_initial_status public.appointment_status := 'confirmed';
  deposit_details jsonb := '{}'::jsonb;
  ignored_appointment_id_text text := nullif(
    current_setting('app.current_reschedule_source_appointment_id', true),
    ''
  );
  ignored_appointment_id uuid := null;
begin
  if ignored_appointment_id_text is not null then
    ignored_appointment_id := ignored_appointment_id_text::uuid;
  end if;

  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  if normalized_payment_preference is not null
    and normalized_payment_preference not in (
      'pix',
      'cash',
      'debit_card',
      'credit_card',
      'to_be_defined'
    ) then
    raise exception 'invalid_payment_preference';
  end if;

  select *
  into customer_profile
  from public.customers
  where auth.uid() = auth_user_id;

  if customer_profile.id is null then
    raise exception 'customer_not_linked';
  end if;

  select *
  into selected_service
  from public.services
  where id = service_uuid
    and salon_id = customer_profile.salon_id;

  if selected_service.id is null then
    raise exception 'service_not_found';
  end if;

  if preferred_staff_member_uuid is not null then
    select exists (
      select 1
      from public.staff_members sm
      join public.staff_service_assignments ssa
        on ssa.staff_member_id = sm.id
      where sm.id = preferred_staff_member_uuid
        and sm.salon_id = customer_profile.salon_id
        and sm.is_active
        and ssa.service_id = selected_service.id
    )
    into preferred_staff_valid;

    if not preferred_staff_valid then
      raise exception 'staff_member_not_available_for_service';
    end if;
  end if;

  select *
  into configured_salon
  from public.salons
  where id = customer_profile.salon_id;

  if configured_salon.id is null then
    raise exception 'salon_not_found';
  end if;

  requested_salon_timezone := configured_salon.timezone;

  if requested_salon_timezone is null then
    raise exception 'schedule_not_found';
  end if;

  if configured_salon.booking_policy_enabled then
    deposit_details := public.resolve_salon_booking_policy_deposit_details(
      configured_salon.id,
      selected_service.price
    );
    effective_deposit_amount := coalesce(
      nullif(btrim(coalesce(deposit_details ->> 'amount', '')), '')::numeric,
      0
    );
    effective_deposit_label := coalesce(
      nullif(btrim(coalesce(deposit_details ->> 'label', '')), ''),
      '0.00'
    );
    effective_protection_auto_cancel_unconfirmed :=
      configured_salon.booking_policy_confirmation_required
      and configured_salon.booking_policy_auto_cancel_unconfirmed;
    effective_protection_auto_cancel_pending_deposit :=
      configured_salon.booking_policy_requires_deposit
      and effective_deposit_amount > 0
      and configured_salon.booking_policy_auto_cancel_pending_deposit;
    effective_booking_policy_version := configured_salon.booking_policy_version;
    effective_booking_policy_snapshot := format(
      E'%s\nResumo: %s\nCancelamento sem atrito ate %s hora(s) antes.\nSinal exigido: %s.\nValor do sinal: %s.\nPagamento/orientacoes: %s\nConfirmacao de presenca: %s, %s min antes.\nAuto cancelamento sem confirmacao: %s, %s min antes.\nAuto cancelamento por sinal pendente: %s.\nLembrete de sinal: %s hora(s) antes.',
      coalesce(nullif(btrim(configured_salon.booking_policy_title), ''), 'Reserva protegida'),
      coalesce(
        nullif(btrim(configured_salon.booking_policy_summary), ''),
        'A reserva segue as regras operacionais definidas pelo salao.'
      ),
      configured_salon.booking_policy_cancellation_window_hours,
      case
        when configured_salon.booking_policy_requires_deposit
          and effective_deposit_amount > 0
          then 'sim'
        else 'nao'
      end,
      effective_deposit_label,
      coalesce(
        nullif(btrim(configured_salon.booking_policy_payment_instructions), ''),
        'Alinhe com o salao a melhor forma de confirmar a reserva.'
      ),
      case when configured_salon.booking_policy_confirmation_required then 'sim' else 'nao' end,
      configured_salon.booking_policy_confirmation_lead_minutes,
      case when effective_protection_auto_cancel_unconfirmed then 'sim' else 'nao' end,
      configured_salon.booking_policy_auto_cancel_lead_minutes,
      case when effective_protection_auto_cancel_pending_deposit then 'sim' else 'nao' end,
      configured_salon.booking_policy_deposit_reminder_lead_hours
    );

    if normalized_booking_policy_input is not null then
      if normalized_booking_policy_input <> configured_salon.booking_policy_version then
        raise exception 'booking_policy_version_stale';
      end if;

      effective_booking_policy_acknowledged_at := timezone('utc', now());
    end if;

    if configured_salon.booking_policy_requires_deposit
      and effective_deposit_amount > 0 then
      effective_deposit_status := 'pending';
    end if;
  end if;

  local_requested_day := (requested_date at time zone requested_salon_timezone)::date;

  select *
  into schedule
  from public.get_salon_schedule_context(customer_profile.salon_id, local_requested_day);

  if schedule.salon_id is null then
    raise exception 'schedule_not_found';
  end if;

  if not schedule.is_open then
    raise exception 'salon_closed_on_selected_day';
  end if;

  if requested_date <= timezone('utc', now()) then
    raise exception 'past_time_not_allowed';
  end if;

  perform 1
  from public.appointments existing_appointment
  where existing_appointment.customer_id = customer_profile.id
    and existing_appointment.status in ('pending', 'confirmed')
    and coalesce(existing_appointment.ends_at, existing_appointment.date) > timezone('utc', now())
    and (existing_appointment.date at time zone requested_salon_timezone)::date = local_requested_day
    and (
      ignored_appointment_id is null
      or existing_appointment.id <> ignored_appointment_id
    )
  limit 1;

  if found then
    raise exception 'customer_has_active_appointment_on_selected_day';
  end if;

  requested_end := requested_date + make_interval(mins => selected_service.duration);

  if requested_date < schedule.opens_at_utc or requested_end > schedule.closes_at_utc then
    raise exception 'outside_business_hours';
  end if;

  if mod(
    extract(epoch from requested_date - schedule.opens_at_utc)::bigint,
    (schedule.slot_step_minutes * 60)::bigint
  ) <> 0 then
    raise exception 'slot_step_mismatch';
  end if;

  select available_slot.staff_member_id
  into resolved_staff_member_id
  from public.get_available_staff_slots_for_service(selected_service.id, local_requested_day) available_slot
  where available_slot.start_at = requested_date
    and (
      preferred_staff_member_uuid is null
      or available_slot.staff_member_id = preferred_staff_member_uuid
    )
  order by available_slot.staff_member_name
  limit 1;

  if resolved_staff_member_id is null then
    raise exception 'time_slot_unavailable';
  end if;

  insert into public.appointments (
    salon_id,
    customer_id,
    service_id,
    staff_member_id,
    date,
    ends_at,
    status,
    payment_preference,
    booking_policy_version,
    booking_policy_snapshot,
    booking_policy_acknowledged_at,
    deposit_amount,
    deposit_status,
    protection_confirmation_required,
    protection_confirmation_lead_minutes,
    protection_auto_cancel_unconfirmed,
    protection_auto_cancel_lead_minutes,
    protection_auto_cancel_pending_deposit,
    protection_deposit_reminder_lead_hours
  )
  values (
    customer_profile.salon_id,
    customer_profile.id,
    selected_service.id,
    resolved_staff_member_id,
    requested_date,
    requested_end,
    effective_initial_status,
    normalized_payment_preference,
    effective_booking_policy_version,
    effective_booking_policy_snapshot,
    effective_booking_policy_acknowledged_at,
    effective_deposit_amount,
    effective_deposit_status,
    configured_salon.booking_policy_confirmation_required,
    configured_salon.booking_policy_confirmation_lead_minutes,
    effective_protection_auto_cancel_unconfirmed,
    configured_salon.booking_policy_auto_cancel_lead_minutes,
    effective_protection_auto_cancel_pending_deposit,
    configured_salon.booking_policy_deposit_reminder_lead_hours
  )
  returning * into created_appointment;

  delete from public.salon_vacancy_alerts
  where salon_id = customer_profile.salon_id
    and service_id = selected_service.id
    and starts_at = requested_date
    and ends_at = requested_end
    and (
      staff_member_id = resolved_staff_member_id
      or staff_member_id is null
    );

  return created_appointment;
exception
  when exclusion_violation then
    raise exception 'time_slot_unavailable';
end;
$$;

grant execute on function public.resolve_salon_booking_policy_deposit_details(uuid, numeric)
to authenticated;

grant execute on function public.create_appointment(uuid, timestamptz, uuid, text, text)
to authenticated;
