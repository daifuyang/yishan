import DictionaryForm from '../DictionaryForm'
import { withAccountScope } from '@/utils/account-scope'
function Page() {
  return <DictionaryForm />
}
export default withAccountScope(Page)
