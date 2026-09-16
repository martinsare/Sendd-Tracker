"use client";
import React from "react";
import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";

export default function PrivacyPage() {
  const { lang, t } = useI18n();

  return (
    <div className="page-wrapper">
      <div className="container" style={{ paddingTop: 36, paddingBottom: 72 }}>
        <div className="stack stack--24" style={{ maxWidth: 860, margin: "0 auto" }}>
          {/* Top navigation */}
          <div>
            <Link href="/" className="btn btn--ghost btn--sm">
              ← {lang === "cy" ? "Dychwelyd i'r Hafan" : "Return to Home"}
            </Link>
          </div>

          {/* Header */}
          <div>
            <div className="badge badge--neutral" style={{ marginBottom: 8 }}>
              {lang === "cy" ? "Llywodraethu a Thryloywder Data" : "Governance & Data Transparency"}
            </div>
            <h1
              style={{
                fontSize: "clamp(1.8rem, 3.5vw, 2.4rem)",
                fontWeight: 800,
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
              }}
            >
              {lang === "cy" ? "Polisi Preifatrwydd ac Ymwadiadau Cyfreithiol" : "Privacy Policy & Legal Disclaimers"}
            </h1>
            <p
              className="text-muted"
              style={{
                marginTop: 8,
                fontSize: "15px",
                lineHeight: 1.6,
              }}
            >
              {lang === "cy"
                ? "Mae Senedd Tracker yn blatfform dinesig anfasnachol, cod agored a gynlluniwyd i wella mynediad at ddata seneddol swyddogol yng Nghymru."
                : "Senedd Tracker is a non-commercial, open-source civic transparency platform designed to improve public accessibility to official Welsh parliamentary records."}
            </p>
          </div>

          {/* Section 1: Privacy by Design */}
          <section className="card" style={{ padding: "24px 28px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 12, color: "var(--text)" }}>
              {lang === "cy" ? "1. Diogelu Data a Phreifatrwydd (UK GDPR)" : "1. Privacy & Data Protection (UK GDPR)"}
            </h2>
            <div className="stack stack--12 text-sm" style={{ lineHeight: 1.7, color: "var(--text2)" }}>
              <p>
                {lang === "cy"
                  ? "Rydym yn gweithredu polisi preifatrwydd llym: nid yw Senedd Tracker yn casglu, storio nac yn gwerthu unrhyw ddata personol adnabyddadwy (PII) gan ddefnyddwyr y wefan."
                  : "We operate a strict privacy-by-design policy: Senedd Tracker does not collect, store, monetize, or track any personally identifiable information (PII) from end users."}
              </p>
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                <li>
                  <strong>{lang === "cy" ? "Chwilio Di-olrhain:" : "Zero Tracking Searches:"}</strong>{" "}
                  {lang === "cy"
                    ? "Mae ymholiadau cod post a chyfansoddiad yn cael eu prosesu ar y hedfan ac nid ydynt yn cael eu cysylltu ag enwau defnyddwyr na chyfeiriadau IP."
                    : "Postcode and constituency searches are processed ephemerally to fetch public representatives; no search queries are linked to user identities or stored on disk."}
                </li>
                <li>
                  <strong>{lang === "cy" ? "Dim Cwcis Olrhain (PECR):" : "No Tracking Cookies (PECR Compliant):"}</strong>{" "}
                  {lang === "cy"
                    ? "Nid ydym yn defnyddio cwcis trydydd parti nac offer marchnata. Defnyddir dim ond storfa leol eich porwr (localStorage) i gofio'ch dewis thema (tywyll/golau) a'ch dewis iaith."
                    : "We do not use advertising, marketing, or tracking cookies. The only client storage used is local browser memory (localStorage) to remember your chosen theme (dark/light) and language preference."}
                </li>
                <li>
                  <strong>{lang === "cy" ? "Logiau Gwallau Glanweithiedig:" : "Sanitized Diagnostic Logs:"}</strong>{" "}
                  {lang === "cy"
                    ? "Mae logiau diagnostig ar /log yn cynnwys dim ond gwallau technegol a chodau cyfeirio (ERR-XXXXXX) heb unrhyw fanylion defnyddiwr."
                    : "Server-side exception logs accessible at /log contain purely sanitized technical error codes (e.g. ERR-XXXXXX) with zero user identifiers or IP addresses."}
                </li>
              </ul>
            </div>
          </section>

          {/* Section 2: Open Data & Licensing */}
          <section className="card" style={{ padding: "24px 28px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 12, color: "var(--text)" }}>
              {lang === "cy" ? "2. Trwyddedu Data Agored a Ffynonellau" : "2. Open Data Licensing & Provenance"}
            </h2>
            <div className="stack stack--12 text-sm" style={{ lineHeight: 1.7, color: "var(--text2)" }}>
              <p>
                {lang === "cy"
                  ? "Daw'r holl ddata seneddol ar y platfform hwn o ddeunyddiau cyhoeddus swyddogol a gyhoeddwyd o dan drwyddedau data agored:"
                  : "All parliamentary records presented on this platform are derived from official public domain open data under recognized statutory licences:"}
              </p>
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                <li>
                  <strong>Senedd Cymru / Welsh Parliament:</strong>{" "}
                  {lang === "cy"
                    ? "Mae trawsgrifiadau Cofnod y Trafodion a chofnodion pleidleisio yn cael eu hailgynhyrchu o dan Drwydded Senedd Agored (Open Parliament Licence)."
                    : "Official Record of Proceedings transcripts and division roll-calls are reproduced under the Open Parliament Licence."}
                </li>
                <li>
                  <strong>TheyWorkForYou (mySociety):</strong>{" "}
                  {lang === "cy"
                    ? "Darperir manylion Aelodau a rhestrau cod post trwy API TheyWorkForYou o dan Drwydded Llywodraeth Agored (Open Government Licence)."
                    : "Member directory metadata and postcode lookups are queried via the TheyWorkForYou API under the Open Government Licence v3.0."}
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3: Legal Disclaimers & Non-Endorsement */}
          <section className="card" style={{ padding: "24px 28px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 12, color: "var(--text)" }}>
              {lang === "cy" ? "3. Ymwadiad Anfasnachol ac Annibyniaeth" : "3. Non-Commercial Civic Disclaimer"}
            </h2>
            <div className="stack stack--12 text-sm" style={{ lineHeight: 1.7, color: "var(--text2)" }}>
              <p>
                {lang === "cy"
                  ? "Mae Senedd Tracker yn brosiect ymchwil academaidd annibynnol a ddatblygwyd ym Mhrifysgol Caerdydd (Ysgol Newyddiaduraeth, Cyfryngau a Diwylliant - JOMEC). Nid yw'n gorff swyddogol i Senedd Cymru nac i Lywodraeth Cymru, ac nid yw wedi'i ardystio ganddynt."
                  : "Senedd Tracker is an independent, non-commercial civic technology research project developed at Cardiff University (School of Journalism, Media and Culture). It is not an official organ of Senedd Cymru or the Welsh Government, and is not affiliated with or endorsed by any political party."}
              </p>
              <p>
                {lang === "cy"
                  ? "Er ein bod yn gwneud pob ymdrech i sicrhau cywirdeb data trwy gysylltu'n uniongyrchol â chofnodion swyddogol Hansard, dylid defnyddio gwefan swyddogol Senedd Cymru ar gyfer dilysiadau ffurfiol a chyfreithiol."
                  : "While every effort is made to maintain high data fidelity with direct links to official Hansard XML exports, users requiring authoritative legal verification should consult official Senedd Cymru records directly."}
              </p>
            </div>
          </section>

          {/* Section 4: Accessibility Commitment */}
          <section className="card" style={{ padding: "24px 28px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 12, color: "var(--text)" }}>
              {lang === "cy" ? "4. Ymrwymiad i Hygyrchedd (WCAG 2.1 AA)" : "4. Accessibility Commitment (WCAG 2.1 AA)"}
            </h2>
            <div className="stack stack--12 text-sm" style={{ lineHeight: 1.7, color: "var(--text2)" }}>
              <p>
                {lang === "cy"
                  ? "Mae'r rhyngwyneb wedi'i ddylunio yn unol â chanllawiau Hygyrchedd Cynnwys Gwe (WCAG 2.1 Lefel AA), gan gynnwys llywio bysellfwrdd llawn, cyferbyniad lliw uchel, a chefnogaeth dwyieithog cyflawn."
                  : "The platform is engineered in accordance with Web Content Accessibility Guidelines (WCAG 2.1 Level AA), providing full keyboard operability, high text contrast ratios (exceeding 4.5:1), and bilingual English/Cymraeg parity."}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

