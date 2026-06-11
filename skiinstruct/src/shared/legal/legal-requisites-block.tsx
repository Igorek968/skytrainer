import { LEGAL_AGENT, legalRegisteredAddress } from "@/lib/legal-entity";

export function LegalRequisitesBlock() {
  const address = legalRegisteredAddress();

  return (
    <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
      <p>
        <strong className="text-foreground">{LEGAL_AGENT.fullName}</strong>
      </p>
      <p>
        ИНН {LEGAL_AGENT.inn}
        <br />
        ОГРН {LEGAL_AGENT.ogrn}
      </p>
      <p>
        Расчётный счёт: <strong className="text-foreground">{LEGAL_AGENT.bankAccount}</strong> в {LEGAL_AGENT.bankName}
        <br />
        БИК {LEGAL_AGENT.bik}
        <br />
        Корр. счёт: {LEGAL_AGENT.corrAccount}
      </p>
      <p>
        Юридический адрес: <span className="text-foreground">{address}</span>
      </p>
      <p>
        Email:{" "}
        <a className="font-medium text-accent underline" href={`mailto:${LEGAL_AGENT.email}`}>
          {LEGAL_AGENT.email}
        </a>
      </p>
    </section>
  );
}
