import 'package:dio/dio.dart';

import '../../../core/network/api_exception.dart';
import '../domain/alerta.dart';

class AlertsApi {
  const AlertsApi(this._dio);

  final Dio _dio;

  Future<List<Alerta>> listar() async {
    try {
      final res = await _dio.get<List<dynamic>>('/alerts');
      return (res.data ?? [])
          .map((e) => Alerta.desdeJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.desdeDio(e);
    }
  }

  /// Marca como vista. No la borra: el historial de cambios detectados queda.
  Future<void> marcarVista(String id) async {
    try {
      await _dio.post<void>('/alerts/$id/acknowledge');
    } on DioException catch (e) {
      throw ApiException.desdeDio(e);
    }
  }
}
