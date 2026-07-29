"use client";

import { useMemo, useState } from "react";
import CustomerCard from "./CustomerCard";
import type { Customer } from "./types";

type Props = {
  customers: Customer[];
  onOpenCustomer: (customer: Customer) => void;
};

export default function CustomersList({
  customers,
  onOpenCustomer,
}: Props) {
  const [search, setSearch] = useState("");

  const filteredCustomers = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return customers;
    }

    return customers.filter((customer) => {
      return (
        customer.full_name.toLowerCase().includes(value) ||
        customer.phone.includes(value)
      );
    });
  }, [customers, search]);

  return (
    <>
      <div className="mb-6">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חפש לפי שם או טלפון..."
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-black"
        />
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
          לא נמצאו לקוחות
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onOpen={onOpenCustomer}
            />
          ))}
        </div>
      )}
    </>
  );
}