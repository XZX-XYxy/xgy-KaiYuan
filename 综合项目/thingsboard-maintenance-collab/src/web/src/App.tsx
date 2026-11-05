import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { LoadingBlock } from "./components/Ui";

const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const AlarmCenter = lazy(() => import("./pages/AlarmCenter").then((module) => ({ default: module.AlarmCenter })));
const WorkOrders = lazy(() => import("./pages/WorkOrders").then((module) => ({ default: module.WorkOrders })));
const Knowledge = lazy(() => import("./pages/Knowledge").then((module) => ({ default: module.Knowledge })));

export function App() {
  return (
    <Suspense fallback={<LoadingBlock label="正在载入工作台" />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="alarms" element={<AlarmCenter />} />
          <Route path="work-orders" element={<WorkOrders />} />
          <Route path="knowledge" element={<Knowledge />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
