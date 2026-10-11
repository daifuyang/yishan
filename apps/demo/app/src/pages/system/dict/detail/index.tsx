import DictionaryDetail from '../DictionaryDetail'
import { withAccountScope } from '../../_shared/AdminUI'
function Page() {
  return <DictionaryDetail />
}
export default withAccountScope(Page)
