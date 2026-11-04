import { lageStatus, type Lage } from '../../domain/drive';
import type { Stop } from '../../domain/types';
import { hm, minSec, signedMinSec } from '../../domain/time';

/** Anzeige der Fahrplanlage: grosse Zahl, Bezeichnung und Zusatzzeile. */
export function lageText(lage: Lage | null, stops: Stop[], times: number[], effLastIdx: number, now: number) {
  const status = lageStatus(lage);
  let big = '–', label = 'Keine Linienfahrt aktiv', sub = '';
  if (lage && stops.length) {
    if (lage.kind === 'pre') {
      const before = now < times[0];
      big = before ? minSec(-lage.value!) : signedMinSec(lage.value!);
      label = before ? 'bis Abfahrt' : 'Abfahrt verpasst';
      sub = `Fahre zur Starthaltestelle ${stops[0].name}`;
    } else if (lage.kind === 'wait') {
      big = minSec(-lage.value!);
      label = lage.idx === 0 ? 'bis Abfahrt' : 'zu früh, bitte warten';
      sub = `Abfahrt ${stops[lage.idx!].name} um ${hm(times[lage.idx!])}`;
    } else if (lage.kind === 'end') {
      big = 'Ende'; label = 'Endhaltestelle erreicht'; sub = 'Fahrzeug leeren, falls noch Fahrgäste an Bord sind';
    } else if (lage.value != null) {
      big = signedMinSec(lage.value);
      label = status === 'ok' ? 'im Fahrplan' : status === 'late' ? 'zu langsam · Verspätung' : 'zu schnell · zu früh';
      sub = lage.kind === 'at' ? `an Haltestelle ${stops[lage.idx!].name}` : `unterwegs nach ${stops[Math.min(effLastIdx + 1, stops.length - 1)].name}`;
    } else {
      label = 'unterwegs'; sub = 'Fahrplanlage ohne Position nicht bestimmbar';
    }
  }
  return { status, big, label, sub };
}
