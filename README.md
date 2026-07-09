# Artemis • BiblioSelect

A powerful UI/UX tool for efficient bibliometric review workflows.

------------------------------------------------------------------------

## 🔎 Overview

Artemis-BiblioSelect is a technical, user-centered software designed to
support **bibliometric screening**, **document triage**, and
**literature review workflows**.\
The system provides high-performance interfaces built with **React**,
**Vite**, and **Electron**, enabling both web-based and desktop
execution.

The tool is optimized for large bibliographic datasets, offering robust
normalization, filtering, and visualization capabilities.

------------------------------------------------------------------------

## ✨ Key Features

-   High-performance **React/Vite** interface\
-   **Electron desktop runtime** (cross-platform)\
-   Bibliographic **import** (Scopus structured format)\
-   Normalization of metadata (title, abstract, DOI, citations)\
-   Configurable screening pipelines\
-   Fast selection workflows with optimized UI/UX\
-   Export of curated bibliographic datasets\
-   Modular architecture and reusable primitives\
-   Open-source and reproducible design

------------------------------------------------------------------------

## 🧩 Architecture Overview

    /src
      /app
        App.jsx
        /routes
          Faq.jsx
          Filtering.jsx
          Home.jsx
          Results.jsx
      /components
        /biblio
        /layout
        /primitives
        /tabs
      /hooks
      /services
    /electron
    /release
      Artemis-Portable-1.0.0-x64.exe
    /benchmark
      run-benchmark.mjs
      README.md
    /examples
      example-100.csv
      tutorial.pdf
    vite.config.js
    package.json

### Core modules:

-   **app/** -- global application shell and routing\
-   **components/biblio/** -- bibliometric UI modules\
-   **hooks/** -- reusable logic (state, I/O, pipelines)\
-   **services/** -- data normalization & processing\
-   **routes/** -- workflow-driven page organization\
-   **electron/** -- desktop runtime integration\
-   **benchmark/** -- scalability benchmark harness and results\
-   **examples/** -- sample dataset and step-by-step usage tutorial

The architecture emphasizes **component reusability**, **functional
purity**, and **UI-driven workflow orchestration**.

------------------------------------------------------------------------

## 🛠️ Installation & Setup

### Option A -- Download the portable app (no build required)

Grab the latest `Artemis-Portable-*.exe` from the
[Releases page](https://github.com/Magrine/artemis-biblioselect/releases/latest)
and run it directly -- it's a portable Windows executable, no installer
needed.

### Option B -- Build and run from source

### 1. Clone the repository

``` sh
git clone https://github.com/Magrine/artemis-biblioselect.git
cd artemis-biblioselect
```

### 2. Install dependencies

``` sh
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is currently required: `react-wordcloud@1.2.7`
> declares a peer dependency on `react@^16.13.0`, while this project uses
> `react@^19.1.1`. A plain `npm install` fails with an `ERESOLVE` error
> without this flag.

### 3. Run in development mode

``` sh
npm run dev
```

### 4. Build

``` sh
npm run build:web           # web production build (dist/)
npm run build:win:portable  # portable Windows desktop build (release/*.exe)
npm run build               # installer-based desktop build (release/)
```

------------------------------------------------------------------------

## 📦 Dependencies

Main stack: - **React 19** - **Vite** - **JavaScript / Node.js** -
**Electron** - **React Router** - **Custom data-processing utilities**

All dependencies are listed in `package.json`.

------------------------------------------------------------------------

## 📂 Supported Data Formats

  Format   Direction         Description
  -------- ----------------- ----------------------------------------
  CSV      Import / Export   Tabular bibliographic datasets

------------------------------------------------------------------------

## 📤 Exporting Data

Artemis-BiblioSelect exports: - Normalized bibliographic datasets
(CSV/JSON)\
- Screening decisions\
- Workflow metadata

------------------------------------------------------------------------

## 📘 Documentation

-   **Step-by-step usage tutorial**: [`examples/tutorial.pdf`](examples/tutorial.pdf)
    -- how to get the app (Release download or build from source) and a
    full walkthrough of a screening session, with real screenshots and a
    sample dataset ([`examples/example-100.csv`](examples/example-100.csv)).
-   **Scalability benchmark**: [`benchmark/README.md`](benchmark/README.md)
    -- methodology, environment, and results for 1,000/5,000/10,000-record
    imports.

Further developer and API documentation will be published at:

➡ https://github.com/Magrine/artemis-biblioselect/wiki

------------------------------------------------------------------------

## 🪪 License

MIT License\
© 2025 Magrine and Contributors

------------------------------------------------------------------------

## 📬 Contact (Support)

edson.cavalcante@usp.br
cavalcantemagrine@gmail.com
