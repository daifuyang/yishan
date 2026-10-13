import DictionaryForm from '../../DictionaryForm'
import { withAccountScope } from '@/utils/account-scope'
function Page() {
  return <DictionaryForm item />
}
export default withAccountScope(Page)
