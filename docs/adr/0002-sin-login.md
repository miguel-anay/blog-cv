# 0002. El blog no tiene login; los exámenes usan un invitado anónimo

- **Estado:** Aceptado
- **Fecha:** 2026-11-04
- **PR:** #32

## Contexto

El blog tenía login con better-auth y magic links por Resend, usado solo para guardar los intentos de examen.
Se decidió que el blog no tenga login.

## Decisión

- Se eliminan better-auth, Resend, `/login` y `/api/auth/*`.
- En `/exams` y `/api/exams`, el middleware asigna un invitado anónimo con la cookie `guest_id`
  (`httpOnly`, un año). El valor tiene que ser un UUID, porque forma parte de la clave en la base.
- La fila del usuario invitado se inserta solo en requests que escriben (no `GET` ni `HEAD`), para no crear
  filas por cada visita.
- Cada ruta de examen sigue comprobando que el intento pertenece al usuario y responde 403 si no.

## Consecuencias

- Los intentos quedan atados al navegador: si se borran las cookies, se pierden.
- No hay datos personales que proteger ni correos que enviar.
- Las variables `BETTER_AUTH_*` de Vercel quedaron sin uso.
