export const isIsraeliPhone=(value:string)=>/^(?:\+972|972|0)(?:5\d|[23489])[- ]?\d{3}[- ]?\d{4}$/.test(value.replace(/\s/g,""));
