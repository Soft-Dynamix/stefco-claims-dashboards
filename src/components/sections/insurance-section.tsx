"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  FolderOpen,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InsuranceCompany {
  id: string;
  name: string;
  shortName: string | null;
  folderName: string;
  senderDomains: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  _count?: { claims: number };
  createdAt: string;
}

export function InsuranceSection() {
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<InsuranceCompany | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    shortName: "",
    folderName: "",
    senderDomains: "",
    contactEmail: "",
    contactPhone: "",
    notes: "",
    isActive: true,
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/insurance");
      const json = await res.json();
      setCompanies(json || []);
    } catch (error) {
      console.error("Failed to fetch companies:", error);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingCompany(null);
    setFormData({
      name: "",
      shortName: "",
      folderName: "",
      senderDomains: "",
      contactEmail: "",
      contactPhone: "",
      notes: "",
      isActive: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (company: InsuranceCompany) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      shortName: company.shortName || "",
      folderName: company.folderName,
      senderDomains: company.senderDomains || "",
      contactEmail: company.contactEmail || "",
      contactPhone: company.contactPhone || "",
      notes: company.notes || "",
      isActive: company.isActive,
    });
    setDialogOpen(true);
  };

  const saveCompany = async () => {
    try {
      const url = editingCompany
        ? `/api/insurance/${editingCompany.id}`
        : "/api/insurance";
      const method = editingCompany ? "PUT" : "POST";

      const body = {
        ...formData,
        senderDomains: formData.senderDomains
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: `Company ${editingCompany ? "updated" : "created"} successfully`,
        });
        setDialogOpen(false);
        fetchCompanies();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save company",
        variant: "destructive",
      });
    }
  };

  const deleteCompany = async (id: string) => {
    if (!confirm("Are you sure you want to delete this company?")) return;

    try {
      const res = await fetch(`/api/insurance/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Company deleted successfully",
        });
        fetchCompanies();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete company",
        variant: "destructive",
      });
    }
  };

  const filteredCompanies = companies.filter((company) =>
    company.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Insurance Companies</h1>
          <p className="text-muted-foreground">
            Manage insurance company registry and folder mappings
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Company
        </Button>
      </div>

      {/* Search */}
      <div className="relative w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search companies..."
          className="pl-8"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Companies Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Short Name</TableHead>
                <TableHead>Folder</TableHead>
                <TableHead>Domains</TableHead>
                <TableHead>Claims</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredCompanies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No companies found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{company.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{company.shortName || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <FolderOpen className="h-3 w-3" />
                        {company.folderName}
                      </div>
                    </TableCell>
                    <TableCell>
                      {company.senderDomains ? (
                        <div className="flex flex-wrap gap-1">
                          {JSON.parse(company.senderDomains).slice(0, 2).map((domain: string) => (
                            <Badge key={domain} variant="outline" className="text-xs">
                              {domain}
                            </Badge>
                          ))}
                          {JSON.parse(company.senderDomains).length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{JSON.parse(company.senderDomains).length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{company._count?.claims || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={company.isActive ? "default" : "secondary"}>
                        {company.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(company)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCompany(company.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? "Edit Company" : "Add Company"}
            </DialogTitle>
            <DialogDescription>
              {editingCompany
                ? "Update insurance company details"
                : "Add a new insurance company to the registry"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData({
                      ...formData,
                      name,
                      folderName: formData.folderName || name.toLowerCase().replace(/\s+/g, "-"),
                    });
                  }}
                />
              </div>
              <div>
                <Label>Short Name</Label>
                <Input
                  value={formData.shortName}
                  onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Folder Name *</Label>
                <Input
                  value={formData.folderName}
                  onChange={(e) => setFormData({ ...formData, folderName: e.target.value })}
                />
              </div>
              <div>
                <Label>Sender Domains</Label>
                <Input
                  placeholder="domain1.com, domain2.com"
                  value={formData.senderDomains}
                  onChange={(e) => setFormData({ ...formData, senderDomains: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Comma-separated list of email domains
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                />
              </div>
              <div>
                <Label>Contact Phone</Label>
                <Input
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCompany}>
              {editingCompany ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
