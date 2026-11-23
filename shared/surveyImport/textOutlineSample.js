/**
 * Canonical ReScope text outline sample — used in UI, docs, and template generation.
 */
export const TEXT_OUTLINE_SAMPLE = `# ReScope text outline — blank line between questions. Lines starting with # are ignored.
# Choice: () single, [] multi, @dropdown + (). Options: {screenout} or {exclusive} suffix.
# Open: ____ once (short) or multiple ____ (long). Explicit types: @nps @matrix @page_break etc.

How satisfied are you with our product overall?
() Very satisfied
() Somewhat satisfied
() Neutral
() Somewhat dissatisfied
() Very dissatisfied {screenout}

Which features do you use regularly? (Select all that apply)
[] Reporting and Analytics
[] Automated Workflows
[] Third-Party Integrations
[] Custom Templates
[] None of the above {exclusive}

@dropdown In which region are you based?
() North America
() Europe
() Asia Pacific
() Other

What is your current job title?
____

Please share any additional feedback (long answer):
____
____

@page_break

@text_block Welcome
Thank you for taking this survey. Your answers are confidential.

@matrix How would you rate each area?
row: Product quality
row: Value for money
row: Customer support
col: Poor
col: Fair
col: Excellent

@nps How likely are you to recommend us to a colleague?

@star_rating Overall experience with our team

@date When did you last use the product?

@phone Best number to reach you if we follow up

@slider How confident are you in this purchase?

@ranking Rank these benefits (most important first)
() Faster delivery
() Lower cost
() Better support

@constant_sum Allocate 100 points across priorities
() Innovation
() Reliability
() Support

@semantic_diff Brand perception

@bipolar_matrix Agreement with each statement

@maxdiff Which factors matter most when choosing a vendor?

@card_sort Sort these feature names into groups
() Dashboards
() Alerts
() Exports

@cascade Select your location (cascade — finish levels in builder)

@textbox_list Brands you have considered
() Brand A
() Brand B
() Brand C

@image_choice_single Preferred visual style (add images in builder)

@image_choice_multi Select all styles that appeal (add images in builder)
`