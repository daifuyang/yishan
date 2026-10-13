import DictionaryDetail from '../../DictionaryDetail'
import { withAccountScope } from '@/utils/account-scope'
function Page() {
  return <DictionaryDetail item />
}
export default withAccountScope(Page)
