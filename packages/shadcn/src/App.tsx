import { BrowserRouter as Router, Routes, Route } from "react-router";
import { MainLayout } from "./layouts";
import { Home } from "./pages/home";
import ProTablePage from "./pages/pro-table";
import QueryFilterPage from "./pages/query-filter";
import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="pro-table" element={<ProTablePage />} />
          <Route path="query-filter" element={<QueryFilterPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
