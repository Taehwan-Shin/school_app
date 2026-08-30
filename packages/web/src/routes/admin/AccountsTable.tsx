import { useState } from "react";
import { useAuth } from "../../lib/auth";
import { useUsersList, type UserItem } from "../../api/usersList";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { CreateUserDialog } from "./CreateUserDialog";
import { DeleteUserDialog, type DeleteUserTarget } from "./DeleteUserDialog";

export function AccountsTable() {
  const { user: currentUser } = useAuth();
  const { data, isLoading, isError, error } = useUsersList();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteUserTarget | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-600">
          조직 내 등록된 사용자 계정 및 권한 상태
        </p>
        <Button
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          data-testid="add-account-btn"
        >
          + 계정 추가
        </Button>
      </div>

      {isLoading && (
        <div className="py-8 text-center text-slate-500 text-sm" data-testid="accounts-loading">
          계정 목록을 불러오는 중...
        </div>
      )}

      {isError && (
        <div
          className="p-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
          data-testid="accounts-error"
        >
          {error?.message?.includes("permission-denied") ||
          error?.message?.includes("PERMISSION_DENIED") ||
          error?.message?.includes("failed-precondition") ||
          error?.message?.includes("http_403")
            ? "이 기능은 관리자만 사용할 수 있습니다."
            : `계정 목록을 불러오지 못했습니다: ${error?.message || "알 수 없는 오류"}`}
        </div>
      )}

      {!isLoading && !isError && (!data?.users || data.users.length === 0) && (
        <div className="py-8 text-center text-slate-500 text-sm" data-testid="accounts-empty">
          계정이 없습니다.
        </div>
      )}

      {!isLoading && !isError && data?.users && data.users.length > 0 && (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="font-semibold text-slate-700">Email</TableHead>
                <TableHead className="font-semibold text-slate-700">이름</TableHead>
                <TableHead className="font-semibold text-slate-700">조직 단위</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center">관리자</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center">정지</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map((user: UserItem) => {
                const fullName = `${user.lastName}${user.firstName}`.trim() || "-";
                const isSelf =
                  Boolean(currentUser?.email) &&
                  currentUser?.email?.toLowerCase() === user.email.toLowerCase();

                return (
                  <TableRow key={user.email}>
                    <TableCell className="font-medium text-slate-900">{user.email}</TableCell>
                    <TableCell className="text-slate-700">{fullName}</TableCell>
                    <TableCell className="text-slate-600 font-mono text-xs">
                      {user.orgUnitPath || "/"}
                    </TableCell>
                    <TableCell className="text-center">
                      {user.isAdmin ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          관리자
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                          일반
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {user.isSuspended ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          정지됨
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          정상
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isSelf}
                        title={isSelf ? "자기 계정은 삭제할 수 없습니다" : "계정 삭제"}
                        onClick={() =>
                          setDeleteTarget({
                            email: user.email,
                            firstName: user.firstName,
                            lastName: user.lastName,
                          })
                        }
                        data-testid={`delete-user-${user.email}`}
                      >
                        삭제
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateUserDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      <DeleteUserDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        user={deleteTarget}
      />
    </div>
  );
}
