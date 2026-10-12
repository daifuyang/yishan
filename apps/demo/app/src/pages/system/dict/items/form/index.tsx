import DictionaryForm from '../../DictionaryForm'
import { withAccountScope } from '../../../_shared/AdminUI'
function Page() {
  return <DictionaryForm item />
}
export default withAccountScope(Page)
