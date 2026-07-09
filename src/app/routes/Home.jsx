// src/app/routes/Home.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Navbar } from "../components/layout/Navbar";
import { Container } from "../components/layout/Container";
import { Footer } from "../components/layout/Footer";
import { CardBody } from "../components/primitives/Card";
import Input from "../components/primitives/Input";
import Button from "../components/primitives/Button";

import { listenUserProjects, createProject } from "../../services/projects";
import artemis from "../../assets/artemis.svg";

export default function Home() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);

  // load user projects (no auth)
  useEffect(() => {
    setProjectsLoading(true);
    const unsub = listenUserProjects(
      undefined,
      (items) => {
        setProjects(items || []);
        setProjectsLoading(false);
      },
      (err) => {
        console.error("Error loading projects:", err);
        setProjectsLoading(false);
      }
    );
    return () => unsub && unsub();
  }, []);

  // create project
  async function handleCreateProject(e) {
    e?.preventDefault?.();
    const name = newProjectName.trim();
    if (!name) return;

    try {
      setCreating(true);
      const { id } = await createProject({ name });
      setNewProjectName("");
      try {
        localStorage.setItem("biblio:activeProject", id);
      } catch {
        ""
      }
    } catch (err) {
      console.error("Error creating project:", err);
    } finally {
      setCreating(false);
    }
  }

  // select project and go to filtering
  function handleSelectProject(id) {
    try {
      localStorage.setItem("biblio:activeProject", id);
    } catch {
      ""
    }
    navigate(`/filtering`, { replace: true });
  }

  const title = useMemo(() => "Your projects", []);

  const pillStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    background: "var(--ink-100, #EEF2F3)",
    color: "var(--ink-800, #1f1b1a)",
    border: "1px solid var(--ink-200, #E5E7EB)",
  };

  return (
    <div className="page-full">
      <Navbar>
        <a
          className="brand"
          href="#"
          aria-label="Home"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          <img src={artemis} alt="Artemis logo" style={{ height: 32 }} />
          <span>ARTEMIS • BiblioSelect</span>
        </a>
        <div className="spacer" />
      </Navbar>

      <Container style={{ placeItems: "center" }}>
        <div
          className="grid cols-2"
          style={{ alignItems: "stretch", marginTop: 24, gap: 16 }}
        >
          {/* Left: intro */}
          <section
            className="card shadow-md"
            style={{ display: "grid", placeItems: "center", padding: 0 }}
          >
            <CardBody>
              <div
                style={{
                  display: "grid",
                  justifyItems: "center",
                  gap: 18,
                  padding: 0,
                }}
              >
                <img
                  src={artemis}
                  alt="Artemis mascot"
                  style={{
                    width: "min(340px, 78%)",
                    maxHeight: 260,
                    objectFit: "contain",
                  }}
                />
                <h1 style={{ textAlign: "center" }}>Artemis BiblioSelect</h1>
                <p
                  className="muted"
                  style={{ textAlign: "center", maxWidth: "56ch" }}
                >
                  <strong>
                    Research doesn't have to feel overwhelming
                  </strong>
                  <br />
                  <br />
                    BiblioSelect simplifies article screening — import your data, tag what matters, and focus your time on analyzing results, writing, and moving your research forward.
                </p>
              </div>
            </CardBody>
          </section>

          {/* Right: projects */}
          <section className="card shadow-md" style={{ display: "flex" }}>
            <CardBody
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: 12, textAlign: "center" }}>{title}</h2>

              <div
                className="stack"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  minHeight: 420,
                  flex: 1,
                }}
              >
                <p
                  className="muted"
                  style={{ marginTop: 0, textAlign: "center" }}
                >
                  <strong>Projects</strong> help you organize your reviews into separate workspaces. Each project keeps its own articles and screening decisions, fully independent from the others.
                </p>

                {projectsLoading ? (
                  <p className="muted">Loading projects…</p>
                ) : (
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      display: "grid",
                      gap: 10,
                      minHeight: 0,
                    }}
                  >
                    {projects.map((p) => {
                      const count =
                        typeof p.itemsCount === "number" ? p.itemsCount : 0;
                      return (
                        <li
                          key={p.id}
                          style={{
                            borderRadius: 12,
                            padding: 12,
                            border: "1px solid var(--ink-300, #D1D5DB)",
                          }}
                        >
                          <div
                            className="row"
                            style={{
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <strong>{p.name}</strong>
                              <div
                                className="muted"
                                style={{ fontSize: 12 }}
                              >
                                {p.updatedAt
                                  ? `Updated on ${new Date(
                                      p.updatedAt
                                    ).toLocaleString()}`
                                  : "—"}
                              </div>
                            </div>

                            <div
                              className="row"
                              style={{ gap: 10, alignItems: "center" }}
                            >
                              <span style={pillStyle}>
                                {count} {count === 1 ? "item" : "items"}
                              </span>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => handleSelectProject(p.id)}
                              >
                                Open
                              </Button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                    {projects.length === 0 && (
                      <li className="muted">
                        No projects yet — create your first one below.
                      </li>
                    )}
                  </ul>
                )}

                <hr className="divider" />

                {/* Create project */}
                <form
                  onSubmit={handleCreateProject}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    alignItems: "end",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <label
                      htmlFor="projectName"
                      style={{
                        display: "block",
                        fontWeight: 600,
                        marginBottom: 6,
                      }}
                    >
                      New project
                    </label>
                    <Input
                      id="projectName"
                      name="projectName"
                      placeholder="Example: Systematic Review 2025"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      required
                      style={{ width: "100%" }}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={creating || !newProjectName.trim()}
                  >
                    {creating ? "Creating..." : "Create Project"}
                  </Button>
                </form>

                <div
                  className="row"
                  style={{
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "auto",
                  }}
                >
                  <div className="muted" style={{ fontSize: 14 }}>
                    {/* empty footer */}
                  </div>
                </div>
              </div>
            </CardBody>
          </section>
        </div>
      </Container>

      <Footer />
    </div>
  );
}
