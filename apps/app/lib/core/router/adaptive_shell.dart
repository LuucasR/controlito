import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Destino de navegacion. La misma lista alimenta la barra inferior en movil
/// y el rail/drawer en pantallas anchas: una sola app, no dos.
class DestinoNavegacion {
  const DestinoNavegacion({
    required this.ruta,
    required this.etiqueta,
    required this.icono,
    required this.iconoSeleccionado,
    this.soloAncho = false,
  });

  final String ruta;
  final String etiqueta;
  final IconData icono;
  final IconData iconoSeleccionado;

  /// Destinos que solo aparecen cuando hay espacio (web/tablet).
  final bool soloAncho;
}

const destinos = <DestinoNavegacion>[
  DestinoNavegacion(
    ruta: '/',
    etiqueta: 'Inicio',
    icono: Icons.dashboard_outlined,
    iconoSeleccionado: Icons.dashboard,
  ),
  DestinoNavegacion(
    ruta: '/servicios',
    etiqueta: 'Servicios',
    icono: Icons.receipt_long_outlined,
    iconoSeleccionado: Icons.receipt_long,
  ),
  DestinoNavegacion(
    ruta: '/alertas',
    etiqueta: 'Alertas',
    icono: Icons.notifications_outlined,
    iconoSeleccionado: Icons.notifications,
  ),
  DestinoNavegacion(
    ruta: '/perfil',
    etiqueta: 'Perfil',
    icono: Icons.person_outline,
    iconoSeleccionado: Icons.person,
  ),
];

/// Layout adaptativo segun las window size classes de Material 3.
///
/// Se decide por ANCHO, nunca por plataforma: un Android en tablet o una
/// ventana de Chrome angosta deben verse como corresponde al espacio real.
class AdaptiveShell extends StatelessWidget {
  const AdaptiveShell({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  static const double _breakpointMedium = 600;
  static const double _breakpointExpanded = 840;
  static const double _breakpointLarge = 1200;
  static const double _maxContentWidth = 1280;

  @override
  Widget build(BuildContext context) {
    final ancho = MediaQuery.sizeOf(context).width;

    // El contenido se limita en pantallas anchas: sin esto, una lista ocupa
    // 1900px de ancho y se vuelve ilegible en un monitor grande.
    final contenido = Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _maxContentWidth),
        child: navigationShell,
      ),
    );

    if (ancho < _breakpointMedium) {
      return Scaffold(
        body: contenido,
        bottomNavigationBar: NavigationBar(
          selectedIndex: navigationShell.currentIndex,
          onDestinationSelected: _irA,
          destinations: [
            for (final d in destinos)
              NavigationDestination(
                icon: Icon(d.icono),
                selectedIcon: Icon(d.iconoSeleccionado),
                label: d.etiqueta,
              ),
          ],
        ),
      );
    }

    final extendido = ancho >= _breakpointExpanded;
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            extended: extendido && ancho >= _breakpointLarge,
            labelType: extendido && ancho >= _breakpointLarge
                ? NavigationRailLabelType.none
                : NavigationRailLabelType.all,
            selectedIndex: navigationShell.currentIndex,
            onDestinationSelected: _irA,
            leading: const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Icon(Icons.account_balance_wallet_outlined),
            ),
            destinations: [
              for (final d in destinos)
                NavigationRailDestination(
                  icon: Icon(d.icono),
                  selectedIcon: Icon(d.iconoSeleccionado),
                  label: Text(d.etiqueta),
                ),
            ],
          ),
          const VerticalDivider(width: 1),
          Expanded(child: contenido),
        ],
      ),
    );
  }

  void _irA(int index) => navigationShell.goBranch(
    index,
    // Volver a tocar el destino actual vuelve a la raiz de esa seccion.
    initialLocation: index == navigationShell.currentIndex,
  );
}
