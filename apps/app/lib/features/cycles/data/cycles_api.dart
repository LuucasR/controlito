import 'package:dio/dio.dart';

import '../../../core/network/api_exception.dart';
import '../domain/ciclo.dart';

class CyclesApi {
  const CyclesApi(this._dio);

  final Dio _dio;

  /// Próximos vencimientos de todos los servicios, ordenados por fecha.
  Future<List<Ciclo>> proximos({int dias = 45}) =>
      _lista('/cycles/upcoming', {'dias': dias});

  /// Períodos de un servicio, del más nuevo al más viejo.
  Future<List<Ciclo>> delServicio(String serviceId) =>
      _lista('/services/$serviceId/cycles', null);

  Future<List<Ciclo>> _lista(String ruta, Map<String, dynamic>? params) async {
    try {
      final res = await _dio.get<List<dynamic>>(ruta, queryParameters: params);
      return (res.data ?? [])
          .map((e) => Ciclo.desdeJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.desdeDio(e);
    }
  }
}
