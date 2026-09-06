import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_exception.dart';
import 'auth_form_scaffold.dart';
import 'providers/auth_controller.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nombre = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();

  bool _cargando = false;
  bool _ocultarPassword = true;
  ApiException? _error;

  @override
  void dispose() {
    _nombre.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _enviar() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _cargando = true;
      _error = null;
    });

    try {
      await ref
          .read(authControllerProvider.notifier)
          .registrar(
            email: _email.text,
            password: _password.text,
            displayName: _nombre.text.trim().isEmpty
                ? null
                : _nombre.text.trim(),
          );
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // El servidor tambien valida. Si devuelve el detalle por campo, se muestra
    // junto al campo y no como un mensaje generico arriba de todo.
    final porCampo = _error is DatosInvalidos
        ? (_error! as DatosInvalidos).errors
        : null;

    return AuthFormScaffold(
      titulo: 'Crear cuenta',
      subtitulo: 'Empezá a controlar tus vencimientos y gastos proyectados',
      hijos: [
        if (_error != null && porCampo == null)
          BannerError(mensaje: _error!.message, detalle: _error!.detail),
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _nombre,
                enabled: !_cargando,
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
                decoration: const InputDecoration(
                  labelText: 'Nombre (opcional)',
                  prefixIcon: Icon(Icons.person_outline),
                ),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _email,
                enabled: !_cargando,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(
                  labelText: 'Email',
                  prefixIcon: const Icon(Icons.mail_outline),
                  errorText: porCampo?['email'],
                ),
                validator: (v) => (v == null || !v.contains('@'))
                    ? 'Ingresá un email válido'
                    : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _password,
                enabled: !_cargando,
                obscureText: _ocultarPassword,
                autofillHints: const [AutofillHints.newPassword],
                textInputAction: TextInputAction.done,
                onFieldSubmitted: (_) => _enviar(),
                decoration: InputDecoration(
                  labelText: 'Contraseña',
                  helperText: 'Al menos 10 caracteres',
                  prefixIcon: const Icon(Icons.lock_outline),
                  errorText: porCampo?['password'],
                  suffixIcon: IconButton(
                    tooltip: _ocultarPassword ? 'Mostrar' : 'Ocultar',
                    icon: Icon(
                      _ocultarPassword
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                    ),
                    onPressed: () =>
                        setState(() => _ocultarPassword = !_ocultarPassword),
                  ),
                ),
                validator: (v) => (v == null || v.length < 10)
                    ? 'La contraseña debe tener al menos 10 caracteres'
                    : null,
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _cargando ? null : _enviar,
                child: _cargando
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Crear cuenta'),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: _cargando ? null : () => context.go('/login'),
                child: const Text('Ya tengo cuenta'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
