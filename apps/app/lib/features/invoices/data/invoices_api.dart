import 'package:dio/dio.dart';

import '../../../core/network/api_exception.dart';
import '../domain/factura.dart';

/// Datos de la factura que llegó.
///
/// El total NO se manda: lo calcula el servidor sumando los componentes, y una
/// restricción en la base verifica que cuadre. Así no puede haber una factura
/// cuyo total no coincida con sus partes.
class NuevaFactura {
  const NuevaFactura({
    required this.cycleId,
    required this.issueDate,
    required this.dueDate,
    required this.currentChargeAmount,
    this.includedPriorDebtAmount,
    this.priorDebtInterestAmount,
    this.otherChargesAmount,
    this.externalNumber,
    this.secondDueDate,
    this.isEstimatedByProvider = false,
    this.notes,
  });

  final String cycleId;
  final String issueDate;
  final String dueDate;
  final String? secondDueDate;
  final String currentChargeAmount;
  final String? includedPriorDebtAmount;
  final String? priorDebtInterestAmount;
  final String? otherChargesAmount;
  final String? externalNumber;
  final bool isEstimatedByProvider;
  final String? notes;

  Map<String, dynamic> aJson() => {
    'cycleId': cycleId,
    'issueDate': issueDate,
    'dueDate': dueDate,
    if (secondDueDate != null) 'secondDueDate': secondDueDate,
    'currentChargeAmount': currentChargeAmount,
    if (includedPriorDebtAmount != null && includedPriorDebtAmount!.isNotEmpty)
      'includedPriorDebtAmount': includedPriorDebtAmount,
    if (priorDebtInterestAmount != null && priorDebtInterestAmount!.isNotEmpty)
      'priorDebtInterestAmount': priorDebtInterestAmount,
    if (otherChargesAmount != null && otherChargesAmount!.isNotEmpty)
      'otherChargesAmount': otherChargesAmount,
    if (externalNumber != null && externalNumber!.isNotEmpty)
      'externalNumber': externalNumber,
    'isEstimatedByProvider': isEstimatedByProvider,
    if (notes != null && notes!.isNotEmpty) 'notes': notes,
  };
}

class InvoicesApi {
  const InvoicesApi(this._dio);

  final Dio _dio;

  Future<Factura> registrar(NuevaFactura nueva) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/invoices',
        data: nueva.aJson(),
      );
      return Factura.desdeJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.desdeDio(e);
    }
  }

  Future<List<Factura>> delServicio(String serviceId) async {
    try {
      final res = await _dio.get<List<dynamic>>(
        '/services/$serviceId/invoices',
      );
      return (res.data ?? [])
          .map((e) => Factura.desdeJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.desdeDio(e);
    }
  }

  Future<void> anular(String id, String motivo) async {
    try {
      await _dio.post<void>('/invoices/$id/void', data: {'reason': motivo});
    } on DioException catch (e) {
      throw ApiException.desdeDio(e);
    }
  }
}
