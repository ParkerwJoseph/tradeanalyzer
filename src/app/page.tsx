"use client"
import PageTemplate from "@/components/layout/PageTemplate"
import React, { useState, useMemo, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Upload, 
  User, 
  Calendar,
  DollarSign, 
  BarChart,
  Percent,
  TrendingUp, 
  TrendingDown,
  LayoutDashboard,
  Wallet,
  X,
  Plus
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { motion } from "framer-motion"

interface Trade {
  symbol: string
  price: number
  quantity: number
  gainLoss: number
  tradeDate: string
  netAmount: number
  accountId: string
}

interface Account {
  id: string
  name: string
  trades: Trade[]
}

const LoadingState = () => {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[120px] w-full" />
      <Skeleton className="h-[400px] w-full" />
      <Skeleton className="h-[200px] w-full" />
    </div>
  )
}

const EmptyState = ({ onUpload }: { onUpload: () => void }) => {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Upload className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No trades yet</h3>
        <p className="text-gray-500 text-center max-w-sm mb-4">
          Upload CSV files for each trading account to start tracking your performance
        </p>
        <Button onClick={onUpload}>
          Upload Account Data
        </Button>
      </CardContent>
    </Card>
  )
}

const UploadDialog = ({ 
  onUpload 
}: { 
  onUpload: (accountName: string, file: File) => Promise<void>
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    if (!accountName.trim() || !selectedFile) {
      setError('Please provide both account name and file')
      return
    }
    
    try {
      await onUpload(accountName, selectedFile)
      setIsOpen(false)
      setAccountName('')
      setSelectedFile(null)
      setError('')
    } catch (err) {
      setError('Error uploading file. Please try again.')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Trading Account</DialogTitle>
          <DialogDescription>
            Upload a CSV file containing trade data for a new account
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="account-name">Account Name</Label>
            <Input
              id="account-name"
              placeholder="e.g., TD Ameritrade, Robinhood, etc."
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Trade Data</Label>
            <div className="flex gap-2">
              <Input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? selectedFile.name : 'Select CSV File'}
              </Button>
              {selectedFile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Upload Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const AccountSelector = ({ 
  accounts,
  selectedAccount,
  onSelect 
}: { 
  accounts: Account[]
  selectedAccount: string
  onSelect: (accountId: string) => void 
}) => {
  return (
    <div className="flex items-center gap-2">
      <Select value={selectedAccount} onValueChange={onSelect}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select Account" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Accounts</SelectItem>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

const TradeList = ({ trades }: { trades: Trade[] }) => {
  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-4">
        {trades.map((trade, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="flex items-center justify-between p-4 rounded-lg border bg-white"
          >
            <div>
              <div className="font-medium">{trade.symbol}</div>
              <div className="text-sm text-gray-500">
                {Math.abs(trade.quantity).toLocaleString()} @ ${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-400">
                {new Date(trade.tradeDate).toLocaleDateString()}
              </div>
            </div>
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm
              ${trade.gainLoss > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
            >
              {trade.gainLoss > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              ${Math.abs(trade.gainLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </motion.div>
        ))}
      </div>
    </ScrollArea>
  )
}

const StatsCard = ({ 
  title, 
  value, 
  change, 
  icon, 
  trend 
}: { 
  title: string
  value: string | number
  change: string
  icon: React.ReactNode
  trend?: boolean 
}) => {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
            {icon}
          </div>
          {trend !== undefined && (
            <span className={trend ? 'text-green-500' : 'text-red-500'}>
              {trend ? <TrendingUp /> : <TrendingDown />}
            </span>
          )}
        </div>
        <div className="mt-4">
          <p className="text-sm text-gray-500">{title}</p>
          <h3 className="text-2xl font-semibold mt-1">{value}</h3>
          <p className="text-sm text-gray-500 mt-2">{change}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function TradeAnalyzer() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState('all')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  const handleFileUpload = async (accountName: string, file: File) => {
    setIsLoading(true)
    
    try {
      const text = await file.text()
      const lines = text.split('\n').slice(2).filter(line => line.trim())
      const accountId = `acc_${Date.now()}`
      
      const parsedTrades = lines.map(line => {
        const values = line.match(/(?:\"([^\"]*)\"|([^,]+))/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || []
        const symbol = values[0].match(/\[(.*?)\]/)?.[1] || values[0]
        
        return {
          symbol,
          price: parseFloat(values[4]) || 0,
          quantity: parseFloat(values[3]) || 0,
          gainLoss: parseFloat(values[7]) || 0,
          tradeDate: values[8] || '',
          netAmount: parseFloat(values[5]) || 0,
          accountId
        }
      })
      
      const newAccount: Account = {
        id: accountId,
        name: accountName,
        trades: parsedTrades
      }
      
      setAccounts(prev => [...prev, newAccount])
    } catch (error) {
      console.error(error)
      throw new Error('Failed to process file')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredTrades = useMemo(() => {
    let trades = selectedAccount === 'all' 
      ? accounts.flatMap(account => account.trades)
      : accounts.find(account => account.id === selectedAccount)?.trades || []
    
    trades = selectedDate
      ? trades.filter(t => t.tradeDate.includes(selectedDate))
      : trades
      
    if (activeTab === 'winning') {
      return trades.filter(t => t.gainLoss > 0)
    } else if (activeTab === 'losing') {
      return trades.filter(t => t.gainLoss < 0)
    } else {
      return trades
    }
  }, [accounts, selectedAccount, selectedDate, activeTab])

  const stats = useMemo(() => {
    if (!filteredTrades.length) return null
    
    const totalPL = filteredTrades.reduce((sum, t) => sum + t.gainLoss, 0)
    const winningTrades = filteredTrades.filter(t => t.gainLoss > 0).length
    const losingTrades = filteredTrades.length - winningTrades
    
    return {
      total: filteredTrades.length,
      winningTrades,
      losingTrades,
      winRate: ((winningTrades / filteredTrades.length) * 100).toFixed(1),
      profitLoss: totalPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      profitLossLabel: totalPL >= 0 ? 'Profit' : 'Loss',
      isProfitable: totalPL >= 0
    }
  }, [filteredTrades])

  const chartData = useMemo(() => {
    const groupedByDate = filteredTrades.reduce((acc, trade) => {
      const date = trade.tradeDate.split(' ')[0]
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(trade)
      return acc
    }, {} as Record<string, Trade[]>)

    return Object.entries(groupedByDate).map(([date, trades]) => ({
      date,
      gainLoss: trades.reduce((sum, trade) => sum + trade.gainLoss, 0),
    }))
  }, [filteredTrades])

  return (
    <PageTemplate title="" description="">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AccountSelector
              accounts={accounts}
              selectedAccount={selectedAccount}
              onSelect={setSelectedAccount}
            />
            <Input
              type="month"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="max-w-xs"
            />
          </div>
          <div className="flex items-center gap-4">
            <UploadDialog onUpload={handleFileUpload} />
            <Avatar className="h-10 w-10">
              <AvatarImage src="/placeholder.svg" />
              <AvatarFallback>EM</AvatarFallback>
            </Avatar>
          </div>
        </div>

        {isLoading ? (
          <LoadingState />
        ) : stats ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatsCard
                title="Total Trades"
                value={stats.total.toLocaleString()}
                change={`${((stats.winningTrades / stats.total) * 100).toFixed(1)}% win rate`}
                icon={<Calendar className="text-blue-500" />}
              />
 <StatsCard
                title="Win Rate"
                value={`${stats.winRate}%`}
                change={`${stats.winningTrades.toLocaleString()} winning trades`}
                icon={<Percent className="text-green-500" />}
              />
              <StatsCard
                title={stats.profitLossLabel}
                value={`$${stats.profitLoss}`}
                change={stats.isProfitable ? 'Profitable' : 'Loss'}
                trend={stats.isProfitable}
                icon={<DollarSign className="text-yellow-500" />}
              />
              <StatsCard
                title="Active Accounts"
                value={accounts.length}
                change={selectedAccount === 'all' ? 'Viewing all accounts' : 'Select to filter'}
                icon={<Wallet className="text-purple-500" />}
              />
            </div>

            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Overview</CardTitle>
                <CardDescription>Daily profit/loss trend</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" stroke="#6B7280" />
                    <YAxis 
                      stroke="#6B7280"
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#FFF',
                        border: '1px solid #E5E7EB',
                        borderRadius: '6px' 
                      }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Profit/Loss']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="gainLoss" 
                      stroke="#2563EB" 
                      strokeWidth={2} 
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Trade History */}
            <Card>
              <CardHeader>
                <CardTitle>Trade History</CardTitle>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="all">All Trades</TabsTrigger>
                    <TabsTrigger value="winning">Winning</TabsTrigger>
                    <TabsTrigger value="losing">Losing</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent>
                <TradeList trades={filteredTrades} />
              </CardContent>
            </Card>
          </div>
        ) : (
          <EmptyState onUpload={() => {
            const dialogTrigger = document.querySelector('[aria-label="Add Account"]') as HTMLButtonElement;
            if (dialogTrigger) {
              dialogTrigger.click();
            }
          }} />
        )}
      </div>
    </PageTemplate>
  );
}

export default TradeAnalyzer;