import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/config/app_environment.dart';
import '../../core/network/snapshot_read_cache.dart';
import '../../core/utils/formatters.dart';
import 'app_models.dart';

typedef CanonicalSalonLandingLoader =
    Future<Map<String, dynamic>?> Function(String joinCode);

class PublicSalonRepository {
  static const _requestTimeout = Duration(seconds: 8);
  static const _landingCacheTtl = Duration(seconds: 45);

  PublicSalonRepository({
    required this.environment,
    required this.client,
    this.supabaseClient,
    CanonicalSalonLandingLoader? canonicalLoader,
  }) : _canonicalLoader = canonicalLoader;

  final AppEnvironment environment;
  final http.Client client;
  final SupabaseClient? supabaseClient;
  final CanonicalSalonLandingLoader? _canonicalLoader;
  final SnapshotReadCache _cache = SnapshotReadCache();

  Future<SalonLandingData?> fetchLanding(
    String joinCode, {
    bool bypassCache = false,
  }) async {
    final normalizedJoinCode = normalizeJoinCode(joinCode);
    if (normalizedJoinCode.isEmpty) {
      return null;
    }

    return _cache.read<SalonLandingData?>(
      key: 'landing:$normalizedJoinCode',
      ttl: _landingCacheTtl,
      bypassCache: bypassCache,
      loader: () =>
          _fetchLandingRemote(normalizedJoinCode, bypassCache: bypassCache),
    );
  }

  Future<SalonLandingData?> _fetchLandingRemote(
    String normalizedJoinCode, {
    required bool bypassCache,
  }) async {
    final uri = environment.publicApiUri(
      '/api/public/salons/$normalizedJoinCode',
    );
    final hasCanonicalSource =
        _canonicalLoader != null || supabaseClient != null;
    if (uri == null) {
      return _fetchLandingFromCanonicalRpc(normalizedJoinCode);
    }

    final requestUri = bypassCache
        ? uri.replace(
            queryParameters: <String, String>{
              ...uri.queryParameters,
              'refresh': DateTime.now().microsecondsSinceEpoch.toString(),
            },
          )
        : uri;

    if (!hasCanonicalSource) {
      return _fetchLandingFromHttp(requestUri, bypassCache: bypassCache);
    }

    final results = await Future.wait<SalonLandingData?>([
      _safeLandingFetch(
        () => _fetchLandingFromHttp(requestUri, bypassCache: bypassCache),
      ),
      _safeLandingFetch(
        () => _fetchLandingFromCanonicalRpc(normalizedJoinCode),
      ),
    ]);

    return _mergeLandingData(fallback: results[0], canonical: results[1]);
  }

  Future<SalonLandingData?> _fetchLandingFromHttp(
    Uri requestUri, {
    required bool bypassCache,
  }) async {
    final response = await client
        .get(
          requestUri,
          headers: bypassCache
              ? const <String, String>{
                  'Accept': 'application/json',
                  'Cache-Control': 'no-cache, no-store, max-age=0',
                  'Pragma': 'no-cache',
                }
              : const <String, String>{'Accept': 'application/json'},
        )
        .timeout(_requestTimeout);
    if (response.statusCode >= 400) {
      return null;
    }

    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    return SalonLandingData.fromJson(payload);
  }

  Future<SalonLandingData?> _fetchLandingFromCanonicalRpc(
    String joinCode,
  ) async {
    final payload = await _fetchCanonicalRpcPayload(joinCode);
    if (payload == null || payload.isEmpty) {
      return null;
    }

    return SalonLandingData.fromJson(payload);
  }

  Future<Map<String, dynamic>?> _fetchCanonicalRpcPayload(
    String joinCode,
  ) async {
    final loader = _canonicalLoader;
    if (loader != null) {
      return loader(joinCode);
    }

    final rpc = supabaseClient;
    if (rpc == null) {
      return null;
    }

    try {
      final dynamic payload = await rpc.rpc(
        'get_public_salon_landing_by_join_code',
        params: <String, dynamic>{'input_join_code': joinCode},
      );
      return _coerceJsonMap(payload);
    } catch (_) {
      return null;
    }
  }

  Future<SalonLandingData?> _safeLandingFetch(
    Future<SalonLandingData?> Function() loader,
  ) async {
    try {
      return await loader();
    } catch (_) {
      return null;
    }
  }

  SalonLandingData? _mergeLandingData({
    required SalonLandingData? fallback,
    required SalonLandingData? canonical,
  }) {
    if (canonical == null) {
      return fallback;
    }
    if (fallback == null) {
      return canonical;
    }

    final mergedPayload = _mergeJsonNodes(
      fallback.toJson(),
      canonical.toJson(),
    );
    final mergedMap = _coerceJsonMap(mergedPayload);
    if (mergedMap == null || mergedMap.isEmpty) {
      return canonical;
    }

    return SalonLandingData.fromJson(mergedMap);
  }

  dynamic _mergeJsonNodes(dynamic fallback, dynamic canonical) {
    if (canonical == null) {
      return fallback;
    }

    if (canonical is Map && fallback is Map) {
      final keys = <String>{
        ...fallback.keys.map((dynamic key) => key.toString()),
        ...canonical.keys.map((dynamic key) => key.toString()),
      };
      return <String, dynamic>{
        for (final key in keys)
          key: _mergeJsonNodes(fallback[key], canonical[key]),
      };
    }

    if (canonical is List) {
      return canonical.isNotEmpty ? canonical : fallback;
    }

    if (canonical is String) {
      return canonical.trim().isNotEmpty ? canonical : fallback;
    }

    return canonical;
  }

  Map<String, dynamic>? _coerceJsonMap(dynamic payload) {
    if (payload is Map) {
      return payload.map(
        (dynamic key, dynamic value) => MapEntry(key.toString(), value),
      );
    }
    return null;
  }
}
