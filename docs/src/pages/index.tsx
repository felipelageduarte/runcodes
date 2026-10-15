import React from "react";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";

// Página raiz: encaminha pras duas seções da documentação.
// /manual é o manual do usuário (público); /admin-docs é a documentação de
// administração/técnica (vai ser embutida na área restrita do admin).
export default function Home(): React.ReactElement {
  return (
    <Layout
      title="Documentação"
      description="Documentação do run.codes — manual do usuário e documentação técnica"
    >
      <main
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "4rem 1.5rem",
        }}
      >
        <h1>run.codes — documentação</h1>
        <p>
          run.codes é uma plataforma de correção automática de exercícios de
          programação. A documentação está dividida em duas seções:
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.5rem",
            marginTop: "2rem",
          }}
        >
          <div className="card" style={{ padding: "1.5rem" }}>
            <h2>Manual do usuário</h2>
            <p>
              Como usar a plataforma, por papel: aluno (entrar numa turma,
              submeter código, entender o resultado) e professor (criar turma,
              exercícios, casos de teste, acompanhar notas).
            </p>
            <Link className="button button--primary" to="/manual/intro">
              Abrir o manual
            </Link>
          </div>
          <div className="card" style={{ padding: "1.5rem" }}>
            <h2>Administração &amp; técnica</h2>
            <p>
              Arquitetura do sistema, operação (pipeline de correção, logs,
              banco de dados), gestão de instituições/usuários/tipos de arquivo
              e troubleshooting.
            </p>
            <Link className="button button--secondary" to="/admin-docs/">
              Abrir a documentação técnica
            </Link>
          </div>
        </div>
      </main>
    </Layout>
  );
}
