import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/alerts/alerts_screen.dart';
import '../../features/auth/domain/session.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/providers/auth_controller.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/profile/profile_screen.dart';
import '../../features/services/presentation/service_detail_screen.dart';
import '../../features/services/presentation/service_form_screen.dart';
import '../../features/services/services_screen.dart';
import 'adaptive_shell.dart';

final _rootKey = GlobalKey<NavigatorState>();

/// Puente entre Riverpod y go_router: el router necesita un Listenable para
/// reevaluar sus redirecciones, y el estado de sesion vive en un provider.
class _EscuchaAuth extends ChangeNotifier {
  _EscuchaAuth(Ref ref) {
    ref.listen(authControllerProvider, (_, _) => notifyListeners());
  }
}

/// StatefulShellRoute preserva el estado de cada seccion al cambiar de pestana
/// y hace que el boton "atras" del navegador funcione como se espera en web.
final routerProvider = Provider<GoRouter>((ref) {
  final escucha = _EscuchaAuth(ref);
  ref.onDispose(escucha.dispose);

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/',
    debugLogDiagnostics: true,
    refreshListenable: escucha,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final ruta = state.matchedLocation;
      final enPantallaDeAuth = ruta == '/login' || ruta == '/registro';

      // Mientras se comprueba si hay sesion guardada no se redirige a ningun
      // lado: si no, la app parpadea hacia el login y vuelve.
      if (auth is AuthComprobando) return null;

      if (auth is AuthSinSesion) return enPantallaDeAuth ? null : '/login';

      // Con sesion activa, login y registro no tienen sentido.
      return enPantallaDeAuth ? '/' : null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/registro', builder: (_, _) => const RegisterScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) =>
            AdaptiveShell(navigationShell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(path: '/', builder: (_, _) => const DashboardScreen()),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/servicios',
                builder: (_, _) => const ServicesScreen(),
                // Van como rutas hijas para que el boton atras del navegador
                // devuelva a la lista y no fuera de la seccion.
                routes: [
                  GoRoute(
                    path: 'nuevo',
                    builder: (_, _) => const ServiceFormScreen(),
                  ),
                  GoRoute(
                    path: ':id',
                    builder: (_, state) => ServiceDetailScreen(
                      servicioId: state.pathParameters['id']!,
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/alertas',
                builder: (_, _) => const AlertsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/perfil',
                builder: (_, _) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
