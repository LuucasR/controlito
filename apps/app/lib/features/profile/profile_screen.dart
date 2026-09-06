import 'package:flutter/material.dart';

import '../../core/network/api_client.dart';
import '../shared/pantalla_pendiente.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) => const PantallaPendiente(
        titulo: 'Perfil',
        icono: Icons.person_outline,
        etapa: 'Etapa 1',
        descripcion:
            'Cuenta, zona horaria y preferencias de notificación.\n\nAPI: $apiBaseUrl',
      );
}
