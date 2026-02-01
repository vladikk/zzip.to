import { BrowserRouter, Routes, Route } from 'react-router-dom';

function Placeholder() {
  return <div>zzip.to Admin</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<Placeholder />} />
      </Routes>
    </BrowserRouter>
  );
}
