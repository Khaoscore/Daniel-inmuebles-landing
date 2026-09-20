import { useState, type ReactNode } from 'react';
import ThemedIcon from './ThemedIcon';

export interface FaqItem {
  question: string;
  /** Respuesta en texto plano; `strong` resalta el fragmento indicado. */
  answer: string;
  emphasis?: string;
}

interface Props {
  items: FaqItem[];
  /** Índice abierto al cargar. En el diseño es la primera pregunta. */
  defaultOpen?: number | null;
}

/** Resalta `emphasis` dentro de la respuesta, como en el diseño. */
function renderAnswer(answer: string, emphasis?: string): ReactNode {
  if (!emphasis || !answer.includes(emphasis)) return answer;

  const [before, after] = answer.split(emphasis);
  return (
    <>
      {before}
      <strong className="font-semibold">{emphasis}</strong>
      {after}
    </>
  );
}

/** Figma: nodos 163:4670 (claro) y 149:1363 (oscuro). */
export default function FaqAccordion({ items, defaultOpen = 0 }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpen);

  return (
    <div className="flex w-full flex-col gap-3">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `faq-panel-${index}`;
        const buttonId = `faq-button-${index}`;

        return (
          <div key={item.question} className="rounded-[14px] bg-card px-[26px] py-[22px]">
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-start justify-between gap-4 text-left"
              >
                <span className="text-[17px] font-semibold text-fg md:text-[19px]">
                  {item.question}
                </span>
                <ThemedIcon name={isOpen ? 'minus' : 'plus'} className="mt-1" />
              </button>
            </h3>

            {isOpen && (
              <div id={panelId} role="region" aria-labelledby={buttonId} className="pt-6">
                <p className="text-[16px] leading-5 text-fg">
                  {renderAnswer(item.answer, item.emphasis)}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
