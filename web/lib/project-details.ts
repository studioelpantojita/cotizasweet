import type {Quote} from './quote';

type ProjectContent=Pick<Quote,'projectBrief'|'event'>;

/** The full brief is the visible project content; old records keep their title as a fallback. */
export function projectDetails(quote:ProjectContent):string {
  return quote.projectBrief.trim()||quote.event.trim();
}

/** Keep the API's bounded legacy title while preserving the complete editable brief. */
export function projectBriefPatch(brief:string):Pick<Quote,'projectBrief'|'event'> {
  const summary=brief.replace(/\s+/g,' ').trim();
  // A slice at 120 UTF-16 units must not leave half of an emoji in the compatibility title.
  const event=summary.slice(0,120).replace(/[\uD800-\uDBFF]$/,'');
  return {projectBrief:brief,event};
}

/** Populate the new control when reopening a proposal created with the former title field. */
export function normalizeProjectDetails(quote:Quote):Quote {
  const projectBrief=quote.projectBrief.trim()?quote.projectBrief:quote.event.trim();
  if(quote.projectBrief===projectBrief&&quote.event.trim())return quote;
  return {...quote,projectBrief,...(!quote.event.trim()?{event:projectBriefPatch(projectBrief).event}:{})};
}
