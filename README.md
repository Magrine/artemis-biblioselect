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
    vite.config.js
    package.json

### Core modules:

-   **app/** -- global application shell and routing\
-   **components/biblio/** -- bibliometric UI modules\
-   **hooks/** -- reusable logic (state, I/O, pipelines)\
-   **services/** -- data normalization & processing\
-   **routes/** -- workflow-driven page organization\
-   **electron/** -- desktop runtime integration

The architecture emphasizes **component reusability**, **functional
purity**, and **UI-driven workflow orchestration**.

------------------------------------------------------------------------

## 🛠️ Installation & Setup

### 1. Clone the repository

``` sh
git clone https://github.com/magrine/artemis-biblioselect.git
cd artemis-biblioselect
```

### 2. Install dependencies

``` sh
npm install
```

### 3. Run in development mode

``` sh
npm run dev
```

### 4. Build production bundle

``` sh
npm run build
```

------------------------------------------------------------------------

## 📦 Dependencies

Main stack: - **React 18** - **Vite** - **JavaScript / Node.js** -
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

Developer and API documentation will be published at:

➡ https://github.com/magrine/artemis-biblioselect/wiki

------------------------------------------------------------------------

## 🪪 License

MIT License\
© 2025 Magrine and Contributors

------------------------------------------------------------------------

## 📬 Contact (Support)

edson.cavalcante@usp.br
cavalcantemagrine@gmail.com
