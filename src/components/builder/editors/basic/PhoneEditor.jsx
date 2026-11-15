import { QuestionLogicPanel } from '../logic/QuestionLogicPanel'

export function PhoneEditor({ question, dispatch, allItems = [], itemIndex = 0 }) {
  return (
    <QuestionLogicPanel
      question={question}
      dispatch={dispatch}
      allItems={allItems}
      itemIndex={itemIndex}
      terminationHint="Terminate based on the number the respondent typed."
      branchHint="Jump respondents when their phone answer matches a rule."
      redirectHint="Send respondents externally when their phone answer matches a rule."
    />
  )
}

export default PhoneEditor
