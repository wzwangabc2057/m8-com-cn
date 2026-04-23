import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  baseUrl: string;
  previousLabel: string;
  nextLabel: string;
}

export function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  baseUrl,
  previousLabel,
  nextLabel,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center items-center gap-2 mt-8">
      {currentPage > 1 ? (
        <Link
          href={`${baseUrl}?page=${currentPage - 1}`}
          className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all text-slate-700 shadow-sm"
          aria-label={previousLabel}
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
      ) : (
        <span className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed">
          <ChevronLeft className="w-5 h-5" />
        </span>
      )}

      <span className="text-sm font-semibold px-4 text-slate-700">
        {currentPage} <span className="text-slate-400 mx-1">/</span> {totalPages}
      </span>

      {currentPage < totalPages ? (
        <Link
          href={`${baseUrl}?page=${currentPage + 1}`}
          className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all text-slate-700 shadow-sm"
          aria-label={nextLabel}
        >
          <ChevronRight className="w-5 h-5" />
        </Link>
      ) : (
        <span className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed">
          <ChevronRight className="w-5 h-5" />
        </span>
      )}
    </div>
  );
}
