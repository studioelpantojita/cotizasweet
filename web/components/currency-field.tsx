'use client';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {FieldError,useFieldValidation} from './quote-validation';
import type {Quote} from '@/lib/quote';

export function CurrencyField({q,onChange}:{q:Quote;onChange:(patch:Partial<Quote>)=>void}){
 const fieldState=useFieldValidation();
 return <div className="currency-setting" data-field="currency"><div className="field"><label className="field-label" htmlFor="quote-currency">Moneda</label><Select value={q.currency} onValueChange={currency=>onChange({currency:currency as Quote['currency']})}><SelectTrigger id="quote-currency" className="commerce-select" aria-describedby="currency-help" {...fieldState('currency')}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="PEN">PEN · Soles</SelectItem><SelectItem value="USD">USD · Dólares</SelectItem></SelectContent></Select><FieldError path="currency"/></div><p id="currency-help" className="field-help">Sin conversión automática de moneda.</p></div>;
}
