import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../auth/domain/session.dart';
import '../auth/presentation/providers/auth_controller.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final theme = Theme.of(context);

    if (auth is! AuthConSesion) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final usuario = auth.usuario;

    return Scaffold(
      appBar: AppBar(title: const Text('Perfil')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: theme.colorScheme.primaryContainer,
                    child: Text(
                      usuario.nombreVisible.characters.first.toUpperCase(),
                      style: theme.textTheme.headlineSmall?.copyWith(
                        color: theme.colorScheme.onPrimaryContainer,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          usuario.nombreVisible,
                          style: theme.textTheme.titleMedium,
                        ),
                        const SizedBox(height: 2),
                        Text(usuario.email, style: theme.textTheme.bodySmall),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                _Dato(
                  icono: Icons.schedule,
                  titulo: 'Zona horaria',
                  valor: usuario.timezone,
                  ayuda: 'Define qué día es "hoy" al evaluar tus vencimientos',
                ),
                const Divider(height: 1),
                _Dato(
                  icono: Icons.attach_money,
                  titulo: 'Moneda',
                  valor: usuario.defaultCurrency,
                ),
                const Divider(height: 1),
                _Dato(
                  icono: Icons.language,
                  titulo: 'Idioma',
                  valor: usuario.locale,
                ),
                const Divider(height: 1),
                const _Dato(
                  icono: Icons.cloud_outlined,
                  titulo: 'API',
                  valor: apiBaseUrl,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () => _confirmarCierre(context, ref),
            icon: const Icon(Icons.logout),
            label: const Text('Cerrar sesión'),
            style: OutlinedButton.styleFrom(
              foregroundColor: theme.colorScheme.error,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmarCierre(BuildContext context, WidgetRef ref) async {
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cerrar sesión'),
        content: const Text(
          'Vas a tener que volver a entrar con tu email y contraseña.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );

    if (confirmado ?? false) {
      await ref.read(authControllerProvider.notifier).cerrarSesion();
    }
  }
}

class _Dato extends StatelessWidget {
  const _Dato({
    required this.icono,
    required this.titulo,
    required this.valor,
    this.ayuda,
  });

  final IconData icono;
  final String titulo;
  final String valor;
  final String? ayuda;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icono),
      title: Text(titulo),
      subtitle: ayuda == null ? null : Text(ayuda!),
      trailing: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 180),
        child: Text(
          valor,
          textAlign: TextAlign.end,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ),
    );
  }
}
