import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from './Container';

export function Footer({ style }) {
  const navigate = useNavigate();

  const goTo = (path) => {
    navigate(path);
  };

  return (
    <footer>
      <Container>
        <div
          className="row"
          style={{
            justifyContent: 'space-between',
            alignItems: 'center',
            ...style,
          }}
        >
          <div className="row" style={{ gap: 16 }}>
            <span>&copy; {new Date().getFullYear()} BiblioSelect</span>
            <span>•</span>
            <button
              className="accent"
              onClick={() => goTo('/faq')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: "1rem",
                fontWeight:"bold"
              }}
            >
              Faq
            </button>
          </div>
          <span className="muted">ESALQ / USP</span>
        </div>
      </Container>
    </footer>
  );
}
