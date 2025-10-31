<p align="center">
<img src="https://media.githubusercontent.com/media/zgsm-ai/costrict/main/src/assets/docs/demo.gif" width="100%" />
</p>

<a href="https://marketplace.visualstudio.com/items?itemName=zgsm-ai.zgsm" target="_blank"><img src="https://img.shields.io/badge/Descargar%20en%20VS%20Marketplace-blue?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Descargar en VS Marketplace"></a>
<a href="https://github.com/zgsm-ai/costrict/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop" target="_blank"><img src="https://img.shields.io/badge/Solicitudes%20de%20Funciones-yellow?style=for-the-badge" alt="Solicitudes de Funciones"></a>
<a href="https://marketplace.visualstudio.com/items?itemName=zgsm-ai.zgsm&ssr=false#review-details" target="_blank"><img src="https://img.shields.io/badge/Valorar%20%26%20Opinar-green?style=for-the-badge" alt="Valorar & Opinar"></a>
<a href="https://docs.roocode.com" target="_blank"><img src="https://img.shields.io/badge/Documentaci%C3%B3n-6B46C1?style=for-the-badge&logo=readthedocs&logoColor=white" alt="Documentación"></a>

</div>
<p align="center">
<a href="https://docs.roocode.com/tutorial-videos">Más tutoriales rápidos y vídeos de funcionalidades...</a>
</p>

## Recursos

### Documentación

- [Guía de uso básico](https://docs.roocode.com/basic-usage/the-chat-interface)
- [Funciones avanzadas](https://docs.roocode.com/advanced-usage/auto-approving-actions)
- [Preguntas frecuentes](https://docs.roocode.com/faq)

### Comunidad

- **Discord:** [Únete a nuestro servidor de Discord](https://discord.gg/roocode) para ayuda en tiempo real y discusiones
- **Reddit:** [Visita nuestro subreddit](https://www.reddit.com/r/RooCode) para compartir experiencias y consejos
- **GitHub:** Reporta [problemas](https://github.com/zgsm-ai/costrict/issues) o solicita [funciones](https://github.com/zgsm-ai/costrict/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop)

---

## Configuración y desarrollo local

1. **Clona** el repositorio:

```sh
git clone https://github.com/zgsm-ai/costrict.git
```

2. **Instala las dependencias**:

```sh
pnpm install
```

3. **Ejecuta la extensión**:

Hay varias formas de ejecutar la extensión Roo Code:

### Modo de desarrollo (F5)

Para el desarrollo activo, utiliza la depuración integrada de VSCode:

Presiona `F5` (o ve a **Ejecutar** → **Iniciar depuración**) en VSCode. Esto abrirá una nueva ventana de VSCode con la extensión Roo Code en ejecución.

- Los cambios en la vista web aparecerán inmediatamente.
- Los cambios en la extensión principal también se recargarán automáticamente.

### Instalación automatizada de VSIX

Para construir e instalar la extensión como un paquete VSIX directamente en VSCode:

```sh
pnpm install:vsix [-y] [--editor=<command>]
```

Este comando hará lo siguiente:

- Preguntará qué comando de editor usar (code/cursor/code-insiders) - por defecto es 'code'
- Desinstalará cualquier versión existente de la extensión.
- Construirá el último paquete VSIX.
- Instalará el VSIX recién construido.
- Te pedirá que reinicies VS Code para que los cambios surtan efecto.

Opciones:

- `-y`: Omitir todas las confirmaciones y usar los valores predeterminados
- `--editor=<command>`: Especifica el comando del editor (p. ej., `--editor=cursor` o `--editor=code-insiders`)

### Instalación manual de VSIX

```sh
code --install-extension bin/zgsm-<version>.vsix
```

1.  Primero, construye el paquete VSIX:
    ```sh
    pnpm vsix
    ```
2.  Se generará un archivo `.vsix` en el directorio `bin/` (p. ej., `bin/zgsm-<version>.vsix`).
3.  Instálalo manualmente usando la CLI de VSCode:
    ```sh
    code --install-extension bin/zgsm-<version>.vsix
    ```

---

Usamos [changesets](https://github.com/changesets/changesets) para el versionado y la publicación. Consulta nuestro `CHANGELOG.md` para ver las notas de la versión.

---

## Aviso legal

**Ten en cuenta** que Roo Code, Inc **no** hace ninguna representación o garantía con respecto a cualquier código, modelo u otras herramientas proporcionadas o puestas a disposición en relación con Roo Code, cualquier herramienta de terceros asociada, o cualquier resultado. Asumes **todos los riesgos** asociados con el uso de dichas herramientas o resultados; tales herramientas se proporcionan "**TAL CUAL**" y "**SEGÚN DISPONIBILIDAD**". Dichos riesgos pueden incluir, sin limitación, infracciones de propiedad intelectual, vulnerabilidades o ataques cibernéticos, sesgo, imprecisiones, errores, defectos, virus, tiempo de inactividad, pérdida o daño de propiedad y/o lesiones personales. Eres el único responsable de tu uso de dichas herramientas o resultados (incluidas, entre otras, la legalidad, idoneidad y resultados de los mismos).

---

## Contribuciones

¡Amamos las contribuciones de la comunidad! Comienza leyendo nuestro [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Colaboradores

¡Gracias a todos nuestros colaboradores que han ayudado a mejorar Roo Code!

<!-- START CONTRIBUTORS SECTION - AUTO-GENERATED, DO NOT EDIT MANUALLY -->

[![Contributors](https://contrib.rocks/image?repo=RooCodeInc/roo-code&max=120&columns=12&cacheBust=0000000000)](https://github.com/RooCodeInc/roo-code/graphs/contributors)

<!-- END CONTRIBUTORS SECTION -->

## Licencia

[Apache 2.0 © 2025 Roo Code, Inc.](../../LICENSE)

---

**¡Disfruta de Roo Code!** Ya sea que lo mantengas con una correa corta o lo dejes deambular de forma autónoma, no podemos esperar a ver qué construyes. Si tienes preguntas o ideas sobre funcionalidades, pásate por nuestra [comunidad de Reddit](https://www.reddit.com/r/RooCode/) o [Discord](https://discord.gg/roocode). ¡Feliz codificación!
