import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { todayKey } from '../lib/date';
import { buildReport, reportText } from '../lib/report';
import { canvasToBlob, drawReport } from '../lib/reportImage';
import { shareFile, shareText } from '../lib/share';
import { Segmented, Sheet } from './ui';
import { Icon } from './Icon';

type Days = '7' | '30';

/** Create a one-page progress report and share it — e.g. with a gym instructor. */
export function ReportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore();
  const profile = store.profile!;
  const [days, setDays] = useState<Days>('30');
  const [img, setImg] = useState<{ url: string; blob: Blob } | null>(null);
  const [busy, setBusy] = useState(false);

  const report = useMemo(() => (open ? buildReport({ data: store.data, profile, days: Number(days), today: todayKey() }) : null), [open, store.data, profile, days]);

  useEffect(() => {
    if (!report) return;
    let cancelled = false;
    let url = '';
    setImg(null);
    drawReport(report, profile.units)
      .then(canvasToBlob)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setImg({ url, blob });
      })
      .catch(() => store.showToast('Couldn’t create the report image.'));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  const fileName = `FuelFlow-progress-${report?.to ?? todayKey()}.png`;
  const empty = report && report.loggedDays === 0 && report.endKg == null;

  return (
    <Sheet open={open} onClose={onClose} title="Share with your trainer">
      <div className="form report-sheet">
        <Segmented<Days>
          label="Report period"
          value={days}
          onChange={setDays}
          options={[
            { value: '7', label: 'Last 7 days' },
            { value: '30', label: 'Last 30 days' },
          ]}
        />
        {empty ? (
          <p className="notice small">Log some food or a weigh-in first — the report is built from your own records.</p>
        ) : (
          <div className="report-preview" aria-live="polite">
            {img ? <img src={img.url} alt={`Progress report for the last ${days} days`} /> : <div className="page-loading" aria-label="Creating report" />}
          </div>
        )}
        <p className="muted small">Made only from what you’ve logged. Nothing is sent until you choose where to share it.</p>
        <div className="sheet-actions">
          <button
            className="btn btn-secondary"
            disabled={!report || !!empty || busy}
            onClick={async () => {
              const r = await shareText(reportText(report!, profile.units), 'My FuelFlow progress');
              if (r === 'copied') store.showToast('Report copied — paste it into a message');
              else if (r === 'failed') store.showToast('Couldn’t share the text.');
            }}
          >
            Send as text
          </button>
          <button
            className="btn btn-primary grow"
            disabled={!img || !!empty || busy}
            onClick={async () => {
              setBusy(true);
              const r = await shareFile(img!.blob, fileName, { title: 'My FuelFlow progress', preferShare: true });
              setBusy(false);
              if (r === 'saved') store.showToast('Report image saved');
              else if (r === 'failed') store.showToast('Couldn’t share the image.');
            }}
          >
            <Icon name="upload" size={16} /> Share image
          </button>
        </div>
      </div>
    </Sheet>
  );
}
