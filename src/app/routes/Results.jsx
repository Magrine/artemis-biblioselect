// src/app/routes/Results.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { Navbar } from "../components/layout/Navbar";
import { Container } from "../components/layout/Container";
import { Footer } from "../components/layout/Footer";
import { Card, CardBody } from "../components/primitives/Card";
import Button from "../components/primitives/Button";

import OverviewTab from "../components/tabs/OverviewTab";
import SourcesTab from "../components/tabs/SourcesTab";
import AuthorsTab from "../components/tabs/AuthorsTab";
import DocumentsTab from "../components/tabs/DocumentsTab";
import OtherTab from "../components/tabs/OtherTab";

// optional: lightweight project state initialization
import { useProjectState } from "../../hooks/useProjectState";
import artemis from "../../assets/artemis.svg";

import { FaUserGroup } from "react-icons/fa6";
import { MdSource } from "react-icons/md";
import { FaPlusSquare, FaHome } from "react-icons/fa";
import { IoDocuments } from "react-icons/io5";

/** Visible tabs: we render all, but only some are enabled for now */
const TABS = [
  { key: "overview",  icon: <FaHome />,       label: "Overview",  enabled: true },
  { key: "sources",   icon: <MdSource />,     label: "Sources",   enabled: true },
  { key: "authors",   icon: <FaUserGroup />,  label: "Authors",   enabled: true },
  { key: "documents", icon: <IoDocuments />,  label: "Documents", enabled: true },
  { key: "other",     icon: <FaPlusSquare />, label: "Other",     enabled: false },
];

export default function Results() {
  const navigate = useNavigate();

  // --- projectId via URL or localStorage ---
  const search =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  const projectId =
    search.get("project") ||
    (typeof window !== "undefined"
      ? localStorage.getItem("biblio:activeProject") || ""
      : "");

  useEffect(() => {
    if (!projectId) return;
    try {
      localStorage.setItem("biblio:activeProject", projectId);
    } catch {""}
  }, [projectId]);

  // --- initial tab (honors ?tab= but forces an enabled tab) ---
  const tabFromUrl = (search.get("tab") || "").toLowerCase();
  const tabStorageKey = useMemo(
    () => (projectId ? `biblio:results:tab:${projectId}` : "biblio:results:tab"),
    [projectId]
  );

  const initialTab = useMemo(() => {
    const enabledKeys = new Set(TABS.filter((t) => t.enabled).map((t) => t.key));
    if (enabledKeys.has(tabFromUrl)) return tabFromUrl;
    try {
      const saved = localStorage.getItem(tabStorageKey);
      if (saved && enabledKeys.has(saved)) return saved;
    } catch {""}
    return "overview";
  }, [tabFromUrl, tabStorageKey]);

  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    try {
      localStorage.setItem(tabStorageKey, activeTab);
    } catch {""}
  }, [activeTab, tabStorageKey]);

  // initialize lightweight project state (OverviewTab has its own hook, but this is harmless)
  useProjectState({
    key: "biblio:ui",
    initialValue: {
      query: "",
      sortMode: "cit_desc",
      currentId: null,
      hiddenIdsArr: [],
      usefulIdsArr: [],
    },
    projectId,
  });

  // --- Tabs: accessibility (← →) respecting enabled tabs ---
  const tabsRef = useRef(null);
  const enabledTabs = TABS.filter((t) => t.enabled);
  const enabledIndex = enabledTabs.findIndex((t) => t.key === activeTab);

  const onKeyDownTabs = useCallback(
    (e) => {
      if (enabledIndex < 0) return;
      let nextIdx = enabledIndex;

      if (e.key === "ArrowRight") {
        nextIdx = (enabledIndex + 1) % enabledTabs.length;
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        nextIdx = (enabledIndex - 1 + enabledTabs.length) % enabledTabs.length;
        e.preventDefault();
      }

      if (nextIdx !== enabledIndex) {
        setActiveTab(enabledTabs[nextIdx].key);
        const btns = tabsRef.current?.querySelectorAll('[role="tab"]');
        const focusables = Array.from(btns || []).filter(
          (el) => !el.hasAttribute("aria-disabled")
        );
        focusables[nextIdx]?.focus?.();
      }
    },
    [enabledIndex, enabledTabs]
  );

  // navigation helpers
  const goHome = useCallback(() => navigate("/"), [navigate]);
  const goFiltering = useCallback(() => {
    const base = "/filtering";
    const url = projectId ? `${base}?project=${encodeURIComponent(projectId)}` : base;
    navigate(url);
  }, [navigate, projectId]);

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
        <Button type="button" variant="secondary" onClick={goFiltering}>
          Back to screening
        </Button>
      </Navbar>

      {/* MAIN */}
      <main style={{ minHeight: 0, paddingBottom: 24 }}>
        <Container style={{ maxWidth: "1400px", paddingLeft: 16, paddingRight: 16 }}>
          {/* TABS */}
          <Card className="surface" style={{ marginBottom: 16 }}>
            <CardBody>
              <div
                ref={tabsRef}
                role="tablist"
                aria-label="Results sections"
                className="row"
                style={{ gap: 8, flexWrap: "wrap" }}
                onKeyDown={onKeyDownTabs}
              >
                {TABS.map((t) => {
                  const selected = activeTab === t.key;
                  const disabled = !t.enabled;
                  return (
                    <button
                      key={t.key}
                      role="tab"
                      aria-selected={selected}
                      aria-controls={`panel-${t.key}`}
                      id={`tab-${t.key}`}
                      className={`btn ${selected ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => !disabled && setActiveTab(t.key)}
                      aria-disabled={disabled ? "true" : undefined}
                      disabled={disabled}
                      title={disabled ? "Coming soon" : undefined}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        opacity: disabled ? 0.6 : 1,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {t.icon}
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* PANELS */}
          <TabPanel when={activeTab === "overview"} id="overview">
            <OverviewTab />
          </TabPanel>
          <TabPanel when={activeTab === "sources"} id="sources">
            <SourcesTab />
          </TabPanel>
          <TabPanel when={activeTab === "authors"} id="authors">
            <AuthorsTab />
          </TabPanel>
          <TabPanel when={activeTab === "documents"} id="documents">
            <DocumentsTab />
          </TabPanel>

          <TabPanel when={activeTab === "other"} id="other">
            <OtherTab />
          </TabPanel>

        </Container>
      </main>

      <Footer />
    </div>
  );
}

/* ------------- Helpers ------------- */

function TabPanel({ when, id, children }) {
  if (!when) return null;
  return (
    <section
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
      style={{ outline: "none" }}
    >
      {children}
    </section>
  );
}
