import 'package:dio/dio.dart';

import '../../../core/network/api_exception.dart';
import '../domain/servicio.dart';

/// Datos para crear un servicio junto con su condición inicial.
class NuevoServicio {
  const NuevoServicio({
    required this.name,
    required this.startDate,
    required this.amountMode,
    required this.frequency,
    required this.debtPolicy,
    required this.interestModel,
    this.providerName,
    this.categoryId,
    this.baseAmount,
    this.dueDayOfMonth,
    this.notes,
    this.changeReason,
  });

  final String name;
  final String? providerName;
  final String? categoryId;
  final String startDate;
  final ModoMonto amountMode;
  final Frecuencia frequency;
  final PoliticaDeuda debtPolicy;
  final ModeloInteres interestModel;
  final String? baseAmount;
  final int? dueDayOfMonth;
  final String? notes;
  final String? changeReason;

  Map<String, dynamic> aJson() => {
    'name': name,
    if (providerName != null && providerName!.isNotEmpty)
      'providerName': providerName,
    if (categoryId != null) 'categoryId': categoryId,
    'startDate': startDate,
    'debtPolicy': debtPolicy.valor,
    if (notes != null && notes!.isNotEmpty) 'notes': notes,
    'condition': {
      'validFrom': startDate,
      'amountMode': amountMode.valor,
      if (baseAmount != null && baseAmount!.isNotEmpty)
        'baseAmount': baseAmount,
      'frequency': frequency.valor,
      if (dueDayOfMonth != null) 'dueDayOfMonth': dueDayOfMonth,
      'interestModel': interestModel.valor,
      if (changeReason != null && changeReason!.isNotEmpty)
        'changeReason': changeReason,
    },
  };
}

/// Datos para agregar una condición nueva a un servicio existente.
class NuevaCondicion {
  const NuevaCondicion({
    required this.validFrom,
    required this.amountMode,
    required this.frequency,
    required this.interestModel,
    this.baseAmount,
    this.dueDayOfMonth,
    this.changeReason,
  });

  final String validFrom;
  final ModoMonto amountMode;
  final Frecuencia frequency;
  final ModeloInteres interestModel;
  final String? baseAmount;
  final int? dueDayOfMonth;
  final String? changeReason;

  Map<String, dynamic> aJson() => {
    'validFrom': validFrom,
    'amountMode': amountMode.valor,
    if (baseAmount != null && baseAmount!.isNotEmpty) 'baseAmount': baseAmount,
    'frequency': frequency.valor,
    if (dueDayOfMonth != null) 'dueDayOfMonth': dueDayOfMonth,
    'interestModel': interestModel.valor,
    if (changeReason != null && changeReason!.isNotEmpty)
      'changeReason': changeReason,
  };
}

class ServicesApi {
  const ServicesApi(this._dio);

  final Dio _dio;

  Future<List<Categoria>> categorias() =>
      _lista(() => _dio.get<List<dynamic>>('/categories'), Categoria.desdeJson);

  Future<List<Servicio>> listar() =>
      _lista(() => _dio.get<List<dynamic>>('/services'), Servicio.desdeJson);

  Future<Servicio> obtener(String id) =>
      _uno(() => _dio.get<Map<String, dynamic>>('/services/$id'));

  Future<Servicio> crear(NuevoServicio nuevo) => _uno(
    () => _dio.post<Map<String, dynamic>>('/services', data: nuevo.aJson()),
  );

  Future<Servicio> agregarCondicion(
    String servicioId,
    NuevaCondicion condicion,
  ) => _uno(
    () => _dio.post<Map<String, dynamic>>(
      '/services/$servicioId/conditions',
      data: condicion.aJson(),
    ),
  );

  Future<void> archivar(String id) async {
    try {
      await _dio.delete<void>('/services/$id');
    } on DioException catch (e) {
      throw ApiException.desdeDio(e);
    }
  }

  Future<List<T>> _lista<T>(
    Future<Response<List<dynamic>>> Function() pedido,
    T Function(Map<String, dynamic>) mapear,
  ) async {
    try {
      final res = await pedido();
      return (res.data ?? [])
          .map((e) => mapear(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.desdeDio(e);
    }
  }

  Future<Servicio> _uno(
    Future<Response<Map<String, dynamic>>> Function() pedido,
  ) async {
    try {
      final res = await pedido();
      return Servicio.desdeJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.desdeDio(e);
    }
  }
}
