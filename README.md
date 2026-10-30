# StructaViz

StructaViz is a browser-based engineering application for preliminary structural analysis and everyday civil engineering calculations. Its main app analyses beams and two-way slabs; a separate toolkit brings together ten calculators for structural, geotechnical, water, surveying, highway and construction work.

The interface is responsive, requires no account, and can be installed as a progressive web app. The main app and toolkit calculations run in the browser. The AI assistant is an online feature and needs the server-side API configured.

## Main app

Open the app to analyse a beam or check a two-way slab.

### Beam analysis

- Model cantilever, simply supported and fixed-fixed single-span beams, or continuous beams with up to three spans.
- Apply point, uniformly distributed (UDL) and triangular loads to a single span; configure UDL or point loads for each span in a continuous beam.
- View live deflection, bending-moment and shear-force diagrams, plus 3D stress and cross-section views.
- Choose a standard UB, UC, RHS or CHS section, or define a parametric rectangular, I, circular or hollow-box section.
- Review deflection, bending stress, shear capacity and safety-factor checks against KS 02-104.
- Estimate material volume, mass and cost using a price per kilogram in Kenyan Shillings (KES).
- Save up to five designs in the browser and export a PDF report.
- Use the section optimizer to search standard sections for the lightest section that passes the checks.

### Two-way slab check

The slab mode checks a slab simply supported on four sides against BS 8110. It reports design moments in both directions, span-to-depth deflection, minimum thickness and required reinforcement. Reinforcement detailing is not included, and the deflection check uses the app's stated deemed-to-satisfy assumption.

### AI assistant

The AI assistant can answer questions using the current beam design inputs and results. It sends requests to the project's `/api/chat` endpoint, which calls Anthropic; it requires internet access and an `ANTHROPIC_API_KEY` configured in the deployment environment. It is not available from a basic static local server.

The AI assistant and section optimizer are presented as Pro features in the app; billing is not yet wired up.

## Engineering toolkit

The toolkit at `hub.html` contains ten standalone calculators:

| Tool | Examples of included calculations |
|---|---|
| Concrete Toolkit | ACI 211 mix design, nominal-mix quantities and cube-result checks |
| Steel and Timber Member Checks | Steel beam and column checks, timber beams and section properties |
| Soil Mechanics Toolkit | Bearing capacity, settlement, earth pressure, Mohr circle and index properties |
| Retaining Wall Stability | Overturning, sliding and base bearing pressure |
| Hydrology and Drainage | Design storms, pipe sizing, open channels and culverts |
| Survey Pro | Traverse adjustment, levelling, curve setting out and coordinate geometry |
| Highway Geometry | Sight distance, horizontal curves and spirals, and vertical curves |
| Earthworks and Quantities | Cut and fill, mass haul, trench quantities and bills of quantities |
| Project Scheduler | Critical path, float, PERT probability and Gantt chart |
| Civil Unit Converter | Engineering units, slope and reinforcement mass |

These calculators run in the browser. The service worker can cache the app and listed toolkit pages for offline use after they have been loaded online.

## Run locally

The project has no build step or package installation requirement. From the repository root, start a static web server:

```bash
python -m http.server 8000
```

Then open:

- Landing page: `http://localhost:8000/`
- Main app: `http://localhost:8000/app.html`
- Toolkit: `http://localhost:8000/hub.html`

The standalone calculators are linked from the toolkit. The AI assistant needs a serverless API runtime and API key, so it will not work when served only with Python's static server.

## Deploy

The site is configured for Vercel. Deploy the repository as a Vercel project; clean URLs are enabled, and `api/chat.js` provides the AI serverless function. Configure `ANTHROPIC_API_KEY` in the Vercel project's environment variables to enable AI requests.

## Repository layout

- `index.html` — product landing page
- `app.html`, `app.css`, `app.js` — beam and slab analysis application
- `hub.html` — searchable and filterable engineering toolkit
- `tools/` — standalone calculators and shared toolkit assets
- `api/chat.js` — server-side AI assistant endpoint
- `sw.js`, `site.webmanifest` — offline caching and installable-app metadata
- `vendor/jspdf.umd.min.js` — PDF report dependency
- `assets/`, `fonts/`, and root-level image files — screenshots, fonts and app icons
- `vercel.json` — Vercel URL and caching configuration

## Engineering disclaimer

StructaViz is intended for preliminary checking and learning. Its results do not replace independent calculations, a review against the applicable design standards, or professional engineering judgment. Verify inputs, assumptions and outputs before relying on them for a project.

## License

No license file is currently included. Contact the project owner before redistributing or reusing the code.
