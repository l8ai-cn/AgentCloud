"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  assignSupportTicketToCurrentAdmin,
  getSupportTicketAttachmentUrl,
  getSupportTicketDetail,
  replySupportTicket,
  updateSupportTicketStatus,
} from "@/lib/api/admin/supportTickets";
import type {
  SupportTicketDetail,
  SupportTicketStatus,
} from "@/lib/api/admin/supportTicketTypes";
import { getErrorMessage } from "@/lib/utils";

export function useSupportTicketDetail(ticketId: number | null) {
  const t = useTranslations("admin");
  const [revision, setRevision] = useState(0);
  const requestKey = `${ticketId ?? "invalid"}:${revision}`;
  const [result, setResult] = useState<{
    key: string;
    data: SupportTicketDetail | null;
    error: string | null;
  }>({ key: "", data: null, error: null });
  const [action, setAction] = useState<"reply" | "status" | "assign" | "download" | null>(null);

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (ticketId === null) return;
    const controller = new AbortController();
    getSupportTicketDetail(ticketId)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, data, error: null });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult((current) => ({
            key: requestKey,
            data: current.data,
            error: getErrorMessage(error, t("support.loadDetailFailed")),
          }));
        }
      });
    return () => controller.abort();
  }, [requestKey, t, ticketId]);

  const reply = useCallback(async (content: string) => {
    if (ticketId === null) return;
    setAction("reply");
    try {
      await replySupportTicket(ticketId, content);
      toast.success(t("support.replySent"));
      reload();
    } catch (error) {
      toast.error(getErrorMessage(error, t("support.replyFailed")));
      throw error;
    } finally {
      setAction(null);
    }
  }, [reload, t, ticketId]);

  const changeStatus = useCallback(async (status: SupportTicketStatus) => {
    if (ticketId === null) return;
    setAction("status");
    try {
      await updateSupportTicketStatus(ticketId, status);
      toast.success(t("support.statusUpdated"));
      reload();
    } catch (error) {
      toast.error(getErrorMessage(error, t("support.statusUpdateFailed")));
      throw error;
    } finally {
      setAction(null);
    }
  }, [reload, t, ticketId]);

  const assignToMe = useCallback(async () => {
    if (ticketId === null) return;
    setAction("assign");
    try {
      await assignSupportTicketToCurrentAdmin(ticketId);
      toast.success(t("support.assigned"));
      reload();
    } catch (error) {
      toast.error(getErrorMessage(error, t("support.assignFailed")));
      throw error;
    } finally {
      setAction(null);
    }
  }, [reload, t, ticketId]);

  const downloadAttachment = useCallback(async (id: number, name: string) => {
    setAction("download");
    try {
      const url = await getSupportTicketAttachmentUrl(id);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    } catch (error) {
      toast.error(getErrorMessage(error, t("support.downloadFailed")));
    } finally {
      setAction(null);
    }
  }, [t]);

  return {
    data: result.data,
    error: result.key === requestKey ? result.error : null,
    loading: result.key !== requestKey,
    action,
    reload,
    reply,
    changeStatus,
    assignToMe,
    downloadAttachment,
  };
}
