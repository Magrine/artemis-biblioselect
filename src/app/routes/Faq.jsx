// src/app/routes/Faq.jsx
import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { Navbar } from "../components/layout/Navbar";
import { Container } from "../components/layout/Container";
import { Footer } from "../components/layout/Footer";
import { Card, CardBody } from "../components/primitives/Card";
import Button from "../components/primitives/Button";
import artemis from "../../assets/artemis.svg";

/**
 * Static FAQ sections.
 **/
const FAQ_SECTIONS = [
  {
    id: "sobre",
    q: "What is BiblioSelect?",
    a: (
      <>
        <p>
          <strong>Artemis • BiblioSelect</strong> is a lightweight tool for
          <strong> local article screening</strong>. You import a CSV with the
          results of your literature search and classify each item as useful or
          not useful. Then you export only the selected items to continue your
          review, analysis, and writing.
        </p>
      </>
    ),
  },
  {
    id: "csv-format",
    q: "Which CSV do I need? Are there required columns?",
    a: (
      <>
        <p>
          Use the <strong>CSV exported from SCOPUS</strong>. The app reads the
          standard headers from that database. The most useful fields are:
        </p>
        <ul>
          <li>
            <code>Title</code> — article title
          </li>
          <li>
            <code>Abstract</code> — abstract
          </li>
          <li>
            <code>DOI</code> — identifier (optional)
          </li>
          <li>
            <code>Cited by</code> — citation count (optional, numeric)
          </li>
        </ul>
        <p className="muted">
          For now we only support the <strong>SCOPUS</strong> format. In future
          versions, we plan to add a <em>field mapping</em> step for other
          databases (e.g., Web of Science, PubMed), while preserving original
          columns in the export.
        </p>
      </>
    ),
  },
  {
    id: "como-importar",
    q: "How do I import the CSV?",
    a: (
      <>
        <ol>
          <li>
            Open <strong>Screening</strong> (after creating/opening a project).
          </li>
          <li>
            Use the <em>Upload CSV</em> button at the top.
          </li>
          <li>
            The file is processed in your browser; you will see the list in the
            left-hand column.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: "projetos",
    q: "What are projects for?",
    a: (
      <p>
        Projects organize your reviews into separate workspaces. Each project
        keeps <strong>its own CSV</strong> and screening state (useful items,
        hidden items, query, and sorting) without affecting the others.
      </p>
    ),
  },
  {
    id: "triagem",
    q: "How does the screening work?",
    a: (
      <>
        <p>
          In the left column, you see the filtered and sorted list. When you
          select an item, the center panel shows the title, abstract, and
          actions:
        </p>
        <ul>
          <li>
            <strong>Add to useful</strong> — moves the item to the selected list
            (right-hand column).
          </li>
          <li>
            <strong>Remove from list</strong> — hides the current item from
            screening (this can be reversed later by clearing the state).
          </li>
          <li>
            <strong>Copy reference</strong> — copies title/DOI/citations to the
            clipboard.
          </li>
        </ul>
        <p>
          The search bar (top toolbar) filters by <em>title</em> and{" "}
          <em>abstract</em>. Sorting can be by citations (↑/↓) or title
          (A–Z/Z–A).
        </p>
      </>
    ),
  },
  {
    id: "resultados",
    q: "When does the “Results” button enable? What is there?",
    a: (
      <>
        <p>
          The <strong>Results</strong> button is enabled when there are no
          remaining items pending classification.
        </p>
      </>
    ),
  },
  {
    id: "exportacao",
    q: "How do I export useful items to a CSV?",
    a: (
      <p>
        In the right-hand column of the Screening page (Selected), click{" "}
        <strong>Download CSV</strong>. The file will contain only the original
        rows marked as useful, preserving the headers from your input file.
      </p>
    ),
  },
  {
    id: "privacidade",
    q: "Are my data sent to any server?",
    a: (
      <p>
        No. CSV processing and screening state happen{" "}
        <strong>locally in your browser</strong>. Preferences are stored in{" "}
        <code>localStorage</code> per project. If you choose to, you can save
        and restore the project file in your own local storage.
      </p>
    ),
  },
  {
    id: "reiniciar",
    q: "What does the RESET button do? Can I undo it?",
    a: (
      <>
        <p>
          <strong>RESET</strong> clears the local cache: CSV, labels
          (useful/hidden), query, sorting, and current selection. This action is{" "}
          <strong>irreversible</strong>. Use with caution.
        </p>
      </>
    ),
  },
  {
    id: "erros-csv",
    q: "I imported a file and nothing appeared. What should I check?",
    a: (
      <ul>
        <li>That the file is actually a <code>.csv</code>.</li>
        <li>That the first line contains a header row.</li>
        <li>
          That there is at least one column with a title and another with an
          abstract (or equivalents) — this improves search and display.
        </li>
        <li>
          That the separator is correct (comma). Some exporters use semicolons;
          in that case, convert or re-export as a standard CSV.
        </li>
      </ul>
    ),
  },
  {
    id: "suporte",
    q: "How can I ask for help or report a problem?",
    a: (
      <p>
        Open a project, describe the problem, and — if possible — include a
        snippet of the CSV (without sensitive data). Error messages from the
        browser console also help with diagnosis.
      </p>
    ),
  },
];

export default function Faq() {
  const navigate = useNavigate();

  const goHome = useCallback(() => navigate("/"), [navigate]);

  return (
    <div className="page-full">
      {/* NAVBAR */}
      <Navbar>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            goHome();
          }}
        >
          <img src={artemis} alt="Artemis logo" style={{ height: 32 }} />
          <span>ARTEMIS • BiblioSelect</span>
        </a>
        <div className="spacer" />
        <Button
          type="button"
          variant="secondary"
          onClick={(e) => {
            e.preventDefault();
            goHome();
          }}
        >
          Back
        </Button>
      </Navbar>

      {/* MAIN */}
      <main style={{ minHeight: 0, paddingBottom: 24 }}>
        <Container style={{ maxWidth: "1000px", paddingLeft: 16, paddingRight: 16 }}>
          {/* Header */}
          <Card className="surface" style={{ marginBottom: 16 }}>
            <CardBody>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: 16,
                  alignItems: "center",
                }}
              >
                <img
                  src={artemis}
                  alt="Artemis mascot"
                  style={{ width: 72, height: 72, objectFit: "contain" }}
                />
                <div>
                  <h1 style={{ margin: 0 }}>Frequently Asked Questions</h1>
                  <p className="muted" style={{ marginTop: 6 }}>
                    Quick answers about projects, CSV import, screening, and export.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Content */}
          <div style={{ display: "grid", gap: 12 }}>
            {FAQ_SECTIONS.map((s) => (
              <Card key={s.id} id={s.id} className="shadow-md">
                <CardBody>
                  <details>
                    <summary
                      style={{
                        cursor: "pointer",
                        listStyle: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontWeight: 600,
                        padding: "6px 0",
                      }}
                      aria-controls={`panel-${s.id}`}
                    >
                      {s.q}
                      <span aria-hidden style={{ opacity: 0.6 }}>
                        ▼
                      </span>
                    </summary>
                    <div id={`panel-${s.id}`} style={{ marginTop: 8 }}>
                      {s.a}
                    </div>
                  </details>
                </CardBody>
              </Card>
            ))}
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
