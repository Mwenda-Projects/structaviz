# StructaViz

StructaViz is a browser-based structural analysis and preliminary design tool focused on steel beam design for Kenyan construction practice. It helps engineers, students, and designers quickly check beam behavior, section adequacy, and approximate cost under KS 02-104-based design logic.

## What it does

- Analyses beam behavior for common support conditions:
  - cantilever
  - simply supported
  - fixed-fixed
- Supports single-span and multi-span beam layouts
- Evaluates:
  - bending moment
  - shear force
  - deflection
  - safety checks
  - section adequacy
- Includes a standard section library:
  - UB
  - UC
  - RHS
  - CHS
- Allows parametric custom section input
- Includes live material cost estimation in Kenyan Shillings (KES)
- Provides an AI assistant for quick design questions and interpretation of results
- Exports a PDF report for design review

## Project purpose

This project is designed for preliminary structural design work and educational use. It is especially useful for checking whether a beam and section are likely to be adequate before a more detailed professional design review.

The app is built for a Kenyan context, with references to KS 02-104 and related steel design conventions.

## Tech stack

This project is a lightweight static web app built with:

- HTML
- CSS
- JavaScript
- Vercel static hosting

## Repository structure

- `index.html` — landing page / marketing page
- `app.html` — main application interface
- `app.css` — styling for the app
- `app.js` — structural calculations, UI logic, and analysis engine
- `api/chat.js` — AI assistant backend logic
- `vercel.json` — Vercel rewrite rules

## Run locally

Because this is a static app, you can run it using any simple local web server.

### Option 1: open directly

Open `app.html` in a browser.

### Option 2: run a local server

From the project root, you can use Python:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

For the app itself:

```text
http://localhost:8000/app
```

## Deployment

This project is configured for Vercel. The rewrite rules in `vercel.json` route:

- `/` → `index.html`
- `/app` → `app.html`
- `/api/*` → `/api/*`

You can deploy this project to Vercel directly from the repository.

## Notes

- This tool is intended for preliminary design checks and educational use.
- Final engineering decisions should still be verified by a registered structural engineer.
- Results are approximate and should be used as a decision-support tool rather than a substitute for formal design verification.

## License

This project does not include a formal license file at the moment. If you plan to publish or distribute it publicly, you should add a license appropriate for your intended use.
