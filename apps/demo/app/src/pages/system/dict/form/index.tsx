import DictionaryForm from '../DictionaryForm'
import { withAccountScope } from '../../_shared/AdminUI'
function Page() {
  return <DictionaryForm />
}
export default withAccountScope(Page)
