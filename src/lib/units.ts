import type { UnitPrefs } from './types';

export const KG_PER_LB = 0.45359237;
export const ML_PER_FLOZ = 29.5735;

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const cmToIn = (cm: number) => cm / 2.54;
export const inToCm = (inch: number) => inch * 2.54;

export function displayWeight(kg: number, units: UnitPrefs, digits = 1): string {
  const v = units.weight === 'lb' ? kgToLb(kg) : kg;
  return `${v.toFixed(digits)} ${units.weight}`;
}

export function weightValue(kg: number, units: UnitPrefs): number {
  const v = units.weight === 'lb' ? kgToLb(kg) : kg;
  return Math.round(v * 10) / 10;
}

export function weightToKg(value: number, units: UnitPrefs): number {
  return units.weight === 'lb' ? lbToKg(value) : value;
}

export function displayWater(ml: number, units: UnitPrefs): string {
  if (units.water === 'floz') return `${Math.round(ml / ML_PER_FLOZ)} fl oz`;
  if (ml >= 1000) return `${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 2).replace(/0$/, '')} L`;
  return `${Math.round(ml)} ml`;
}

export function waterToMl(value: number, units: UnitPrefs): number {
  return units.water === 'floz' ? Math.round(value * ML_PER_FLOZ) : Math.round(value);
}

export function displayHeight(cm: number, units: UnitPrefs): string {
  if (units.height === 'ftin') {
    const total = Math.round(cmToIn(cm));
    return `${Math.floor(total / 12)}′ ${total % 12}″`;
  }
  return `${Math.round(cm)} cm`;
}
