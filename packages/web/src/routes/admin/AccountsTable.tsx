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
        <p className="text-small text-fg-secondary">
          조직 내 등록된 사용자 계정 및 권한 상태
        </p>
        <Button
          onClick={() => setIsCreateOpen(true)}
          data-testid="add-account-btn"
        >
          + 계정 추가
        </Button>
      </div>

      {isLoading && (
        <div className="py-8 text-center text-small text-fg-secondary" data-testid="accounts-loading">
          계정 목록을 불러오는 중...
        </div>
      )}

      {isError && (
        <div
          className="border border-state-danger p-4 text-small text-state-danger"
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
        <div className="py-12 text-center text-small text-fg-secondary" data-testid="accounts-empty">
          등록된 계정이 없습니다.
        </div>
      )}

      {!isLoading && !isError && data?.users && data.users.length > 0 && (
        <div className="border border-border-subtle rounded-none overflow-x-auto bg-canvas">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>조직 단위</TableHead>
                <TableHead className="text-center">관리자</TableHead>
                <TableHead className="text-center">정지</TableHead>
                <TableHead className="text-right">관리</TableHead>
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
                    <TableCell className="font-mono text-small text-fg-primary">{user.email}</TableCell>
                    <TableCell className="text-fg-primary">{fullName}</TableCell>
                    <TableCell className="font-mono text-small text-fg-secondary">
                      {user.orgUnitPath || "/"}
                    </TableCell>
                    <TableCell className="text-center">
                      {user.isAdmin ? (
                        <span className="text-micro font-medium text-fg-primary">
                          관리자
                        </span>
                      ) : (
                        <span className="text-micro text-fg-muted">
                          일반
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {user.isSuspended ? (
                        <span className="text-micro font-medium text-state-danger">
                          정지됨
                        </span>
                      ) : (
                        <span className="text-micro text-fg-muted">
                          정상
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
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
                        className={
                          isSelf
                            ? "text-fg-muted cursor-not-allowed no-underline text-small"
                            : "text-state-danger underline decoration-transparent hover:decoration-state-danger text-small transition-colors cursor-pointer"
                        }
                      >
                        삭제
                      </button>
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

