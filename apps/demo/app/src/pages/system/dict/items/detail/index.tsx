import DictionaryDetail from '../../DictionaryDetail'
import { withAccountScope } from '../../../_shared/AdminUI'
function Page() {
  return <DictionaryDetail item />
}
export default withAccountScope(Page)
