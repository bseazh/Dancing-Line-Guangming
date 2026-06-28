# Dancing Line 3D Deploy Package

This package contains both the static website and the editable source project.

## Direct Static Deployment

Upload everything inside:

```text
static-site/
```

to your static hosting service, such as Nginx, GitHub Pages, Netlify, Vercel static output, or a CDN bucket.

The app is a Vite static build. The entry file is:

```text
static-site/index.html
```

## Source Project

Editable project files are inside:

```text
project-source/
```

Main folders:

```text
project-source/src/       TypeScript source code
project-source/public/    Static assets copied into the production build
project-source/dist/      Not included here; use static-site/ for deployment
```

## Rebuild

From `project-source/`:

```bash
npm install --include=dev
npm run build
```

After rebuilding, the production files will be in:

```text
project-source/dist/
```

## Local Preview

From `project-source/`:

```bash
npm run dev
```

Then open the local URL printed by Vite.
