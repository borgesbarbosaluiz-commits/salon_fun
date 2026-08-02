create or replace function public.get_public_salon_landing_by_join_code(input_join_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_preview record;
  v_join_code text;
  v_client_config jsonb := '{}'::jsonb;
  v_app_name text;
  v_brand_color text;
  v_accent_color text;
  v_whatsapp_phone text;
  v_whatsapp_url text;
  v_visible_home_modules jsonb := '[]'::jsonb;
  v_module_labels jsonb := '[]'::jsonb;
  v_theme_mode text := 'light';
  v_corner_style text := 'soft';
  v_preview_payload jsonb := '{}'::jsonb;
  v_custom_domain text;
  v_white_label_active boolean := false;
  v_public_app_url text;
begin
  select *
  into v_preview
  from public.get_public_salon_by_join_code(input_join_code)
  limit 1;

  if v_preview.id is null then
    return null;
  end if;

  v_join_code := upper(trim(coalesce(input_join_code, '')));
  v_client_config := coalesce(v_preview.client_app_config, '{}'::jsonb);
  v_theme_mode := case
    when lower(coalesce(v_client_config ->> 'theme', 'claro')) = 'escuro' then 'dark'
    else 'light'
  end;
  v_corner_style := lower(coalesce(v_client_config ->> 'cornerStyle', 'soft'));
  v_app_name := coalesce(
    nullif(btrim(coalesce(v_client_config ->> 'appName', '')), ''),
    v_preview.name,
    'Salao'
  );
  v_brand_color := coalesce(
    nullif(btrim(coalesce(v_client_config ->> 'primaryColor', '')), ''),
    v_preview.brand_color,
    '#C15F43'
  );
  v_accent_color := nullif(btrim(coalesce(v_client_config ->> 'accentColor', '')), '');
  v_whatsapp_phone := coalesce(
    nullif(btrim(coalesce(v_client_config ->> 'supportPhone', '')), ''),
    nullif(btrim(coalesce(v_preview.whatsapp_phone, '')), '')
  );
  v_custom_domain := nullif(lower(btrim(coalesce(v_client_config ->> 'customDomain', ''))), '');
  v_white_label_active := coalesce((v_client_config ->> 'whiteLabelActive')::boolean, false);
  v_public_app_url := case
    when v_white_label_active and v_custom_domain is not null then 'https://' || v_custom_domain
    else null
  end;
  v_whatsapp_url := case
    when coalesce(v_whatsapp_phone, '') = '' then null
    else 'https://wa.me/' || regexp_replace(v_whatsapp_phone, '\D', '', 'g')
  end;
  v_visible_home_modules := to_jsonb(array_remove(array[
    'nextBooking'::text,
    'shortcuts'::text,
    'promotions'::text,
    case
      when coalesce((v_client_config ->> 'showLoyalty')::boolean, true) then 'loyalty'
      else null
    end,
    case
      when coalesce((v_client_config ->> 'showStore')::boolean, true) then 'products'
      else null
    end,
    case
      when coalesce((v_client_config ->> 'showFeed')::boolean, true) then 'gallery'
      else null
    end
  ], null));
  v_module_labels := to_jsonb(array_remove(array[
    'Proximo horario'::text,
    'Atalhos'::text,
    'Ofertas'::text,
    case
      when coalesce((v_client_config ->> 'showLoyalty')::boolean, true) then 'Fidelidade'
      else null
    end,
    case
      when coalesce((v_client_config ->> 'showStore')::boolean, true) then 'Produtos'
      else null
    end,
    case
      when coalesce((v_client_config ->> 'showFeed')::boolean, true) then 'Galeria'
      else null
    end
  ], null));

  v_preview_payload :=
    jsonb_build_object(
      'salonId', v_preview.id::text,
      'joinCode', v_join_code,
      'name', coalesce(v_preview.name, 'Salao'),
      'appDisplayName', v_app_name,
      'tagline', coalesce(
        nullif(btrim(coalesce(v_client_config ->> 'tagline', '')), ''),
        v_preview.tagline
      ),
      'brandColor', v_brand_color,
      'backgroundColor', nullif(btrim(coalesce(v_client_config ->> 'backgroundColor', '')), ''),
      'textColor', nullif(btrim(coalesce(v_client_config ->> 'textColor', '')), ''),
      'secondaryColor', null,
      'accentColor', v_accent_color,
      'experienceModel', null,
      'homeEmphasis', case
        when coalesce((v_client_config ->> 'showFeed')::boolean, false) then 'portfolio'
        when coalesce((v_client_config ->> 'showStore')::boolean, false) then 'benefits'
        else 'services'
      end,
      'logoUrl', coalesce(
        nullif(btrim(coalesce(v_preview.logo_path, '')), ''),
        nullif(btrim(coalesce(v_client_config ->> 'logoImage', '')), '')
      ),
      'heroImageUrl', nullif(btrim(coalesce(v_client_config ->> 'heroImage', '')), ''),
      'galleryCoverImageUrl', nullif(btrim(coalesce(v_client_config ->> 'galleryCoverImage', '')), ''),
      'profileCoverImageUrl', nullif(btrim(coalesce(v_client_config ->> 'profileCoverImage', '')), ''),
      'shareImageUrl', nullif(btrim(coalesce(v_client_config ->> 'shareImage', '')), ''),
      'heroHeadline', coalesce(
        nullif(btrim(coalesce(v_client_config ->> 'heroTitle', '')), ''),
        v_app_name
      ),
      'heroSupportLine', nullif(btrim(coalesce(v_client_config ->> 'heroSubtitle', '')), '')
    ) ||
    jsonb_build_object(
      'welcomeHeadline', v_app_name,
      'welcomeMessage', coalesce(
        nullif(btrim(coalesce(v_client_config ->> 'welcomeMessage', '')), ''),
        nullif(btrim(coalesce(v_preview.tagline, '')), ''),
        v_app_name
      ),
      'primaryCtaLabel', coalesce(
        nullif(btrim(coalesce(v_client_config ->> 'heroCta', '')), ''),
        'Reservar horario'
      ),
      'visualStyle', 'auto',
      'themeMode', v_theme_mode,
      'fontStyle', nullif(lower(btrim(coalesce(v_client_config ->> 'fontStyle', ''))), ''),
      'cornerStyle', v_corner_style,
      'buttonStyle', case v_corner_style
        when 'round' then 'capsule'
        when 'sharp' then 'elevated'
        else 'rounded'
      end,
      'cardStyle', case v_corner_style
        when 'round' then 'glass'
        when 'sharp' then 'outlined'
        else 'floating'
      end,
      'bannerStyle', case
        when v_theme_mode = 'dark' then 'immersive'
        else 'editorial'
      end,
      'promotionHeadline', coalesce(
        nullif(btrim(coalesce(v_client_config ->> 'heroTitle', '')), ''),
        'Destaques do salao'
      ),
      'segmentLabel', coalesce(
        nullif(btrim(coalesce(v_preview.business_segment, '')), ''),
        'Salao'
      ),
      'segmentDescription', '',
      'visibleHomeModules', v_visible_home_modules,
      'moduleLabels', v_module_labels
    ) ||
    jsonb_build_object(
      'highlightBlocks', case
        when jsonb_typeof(v_client_config -> 'highlightBlocks') = 'array' then v_client_config -> 'highlightBlocks'
        else '[]'::jsonb
      end,
      'showPrices', coalesce((v_client_config ->> 'showPrices')::boolean, true),
      'showTeam', coalesce((v_client_config ->> 'showTeam')::boolean, true),
      'addressLabel', nullif(btrim(coalesce(v_client_config ->> 'address', '')), ''),
      'whatsappPhone', v_whatsapp_phone,
      'mapUrl', null,
      'supportUrl', v_whatsapp_url,
      'supportEmail', null,
      'ratingValue', null,
      'ratingCount', null,
      'whiteLabelActive', v_white_label_active,
      'customDomain', v_custom_domain,
      'publicAppUrl', v_public_app_url,
      'bookingPolicyEnabled', coalesce(
        (v_client_config ->> 'allowOnlineBooking')::boolean,
        coalesce(v_preview.booking_policy_enabled, false)
      ),
      'bookingPolicyTitle', v_preview.booking_policy_title,
      'bookingPolicySummary', v_preview.booking_policy_summary,
      'bookingPaymentMode', v_preview.booking_policy_payment_mode,
      'bookingRequiresDeposit', coalesce(
        (v_client_config ->> 'requireDeposit')::boolean,
        coalesce(v_preview.booking_policy_requires_deposit, false)
      ),
      'bookingDepositAmount', v_preview.booking_policy_deposit_amount,
      'bookingDepositPercent', nullif(btrim(coalesce(v_client_config ->> 'depositPercent', '')), '')::numeric,
      'bookingPaymentInstructions', v_preview.booking_policy_payment_instructions,
      'bookingPixKey', v_preview.booking_policy_pix_key,
      'bookingPixRecipientName', v_preview.booking_policy_pix_recipient_name,
      'bookingPixRecipientCity', v_preview.booking_policy_pix_recipient_city,
      'bookingExternalCheckoutUrl', v_preview.booking_policy_external_checkout_url
    );

  return jsonb_build_object(
    'joinCode', v_join_code,
    'preview', v_preview_payload,
    'featuredServices', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id::text,
          'name', s.name,
          'category', s.category,
          'description', s.description,
          'duration', s.duration,
          'price', s.price,
          'imageUrl', nullif(btrim(coalesce(s.image_path, '')), '')
        )
        order by coalesce(s.sort_order, 0), s.name
      )
      from public.services s
      where s.salon_id = v_preview.id
        and s.is_active = true
      limit 12
    ), '[]'::jsonb),
    'activeOffers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id::text,
          'kind', case when o.kind = 'membership' then 'membership' else 'promotion' end,
          'title', o.title,
          'description', o.description,
          'highlightText', o.highlight_text,
          'imageUrl', nullif(btrim(coalesce(o.image_path, '')), ''),
          'bookingServiceId', o.membership_service_id::text,
          'bookingServiceName', svc.name,
          'actionKind', case
            when o.kind = 'membership' then 'request_membership'
            when o.membership_service_id is not null then 'book_service'
            else 'open_agenda'
          end,
          'kindLabel', case when o.kind = 'membership' then 'Plano' else 'Oferta ativa' end,
          'priceLabel', null,
          'lifecycleLabel', 'Ativo agora'
        )
        order by coalesce(o.sort_order, 0), o.title
      )
      from public.salon_offers o
      left join public.services svc on svc.id = o.membership_service_id
      where o.salon_id = v_preview.id
        and o.is_active = true
      limit 12
    ), '[]'::jsonb),
    'recentPosts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id::text,
          'title', coalesce(nullif(trim(p.title), ''), 'Trabalho recente'),
          'caption', p.caption,
          'imageUrl', coalesce(
            (
              select nullif(btrim(coalesce(spi.image_path, '')), '')
              from public.salon_post_images spi
              where spi.post_id = p.id
              order by coalesce(spi.sort_order, 0), spi.id
              limit 1
            ),
            nullif(btrim(coalesce(p.image_path, '')), '')
          ),
          'badge', case
            when p.post_type = 'before_after' then 'Antes e depois'
            when p.post_type = 'reel' then 'Video'
            else null
          end,
          'serviceName', svc.name,
          'staffLabel', st.name,
          'authorAvatarUrl', p.external_author_avatar_url,
          'sourceLabel', null
        )
        order by p.created_at desc
      )
      from public.salon_posts p
      left join public.services svc on svc.id = p.service_id
      left join public.staff_members st on st.id = p.staff_member_id
      where p.salon_id = v_preview.id
        and p.post_type <> 'story'
      limit 6
    ), '[]'::jsonb),
    'centralCampaigns', '[]'::jsonb,
    'stats', jsonb_build_object(
      'servicesCount', (
        select count(*)
        from public.services s
        where s.salon_id = v_preview.id
          and s.is_active = true
      ),
      'activeOffersCount', (
        select count(*)
        from public.salon_offers o
        where o.salon_id = v_preview.id
          and o.is_active = true
      ),
      'recentPostsCount', (
        select count(*)
        from public.salon_posts p
        where p.salon_id = v_preview.id
          and p.post_type <> 'story'
      )
    ),
    'links', jsonb_build_object(
      'whatsappUrl', v_whatsapp_url,
      'mapUrl', null,
      'supportUrl', v_whatsapp_url,
      'supportEmail', null,
      'privacyPolicyUrl', null,
      'termsOfUseUrl', null,
      'publicAppUrl', v_public_app_url
    )
  );
end;
$$;

grant execute on function public.get_public_salon_landing_by_join_code(text) to anon;
grant execute on function public.get_public_salon_landing_by_join_code(text) to authenticated;
