import { pieceById } from '../../shared/estimator';
import type { JobSheet } from '../../shared/types';

export function JobSheetView({ sheet, headingLevel = 2 }: { sheet: JobSheet; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const u = sheet.units ?? '';
  const v = (n: number | null) => (n == null ? 'not given yet' : `${n} ${u}`.trim());
  return (
    <section className="card sheet" aria-labelledby="sheet-h">
      <H id="sheet-h">Job sheet</H>
      <dl>
        <dt>Piece</dt>
        <dd>{sheet.piece ? pieceById(sheet.piece).label : 'not given yet'}</dd>
        <dt>Width</dt>
        <dd>{v(sheet.width)}</dd>
        <dt>Depth</dt>
        <dd>{v(sheet.depth)}</dd>
        <dt>Height</dt>
        <dd>{v(sheet.height)}</dd>
        <dt>Units</dt>
        <dd>{sheet.units === 'in' ? 'inches' : sheet.units === 'cm' ? 'centimetres' : 'not confirmed'}</dd>
        <dt>Fabric</dt>
        <dd>{sheet.fabric ?? 'not chosen yet'}</dd>
        {sheet.notes.length > 0 && (
          <>
            <dt>Notes</dt>
            <dd>{sheet.notes.join(' · ')}</dd>
          </>
        )}
      </dl>
    </section>
  );
}
