import React, { useState, useMemo } from 'react'
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
  Users,
  FileText,
  Settings,
  LogOut,
  Newspaper,
  BookText,
  BellIcon
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { motion } from "framer-motion"



interface Trade {
  symbol: string
  price: number
  quantity: number
  gainLoss: number
  tradeDate: string
  netAmount: number
}

interface Position {
  symbol: string
  quantity: number
  averagePrice: number
  currentPrice: number
  unrealizedPL: number
  marketValue: number
  percentChange: number
}

const navigationItems = [
  { icon: <LayoutDashboard size={20} />, label: 'Overview', path: '/' },
  { icon: <BarChart size={20} />, label: 'Watchlist', path: '/components/watchlist' },
  { icon: <Newspaper size={20} />, label: 'News Page', path: '/components/news' },
  { icon: <BellIcon size={20} />, label: 'Notifications', path: '/components/notifications' },
  { icon: <Settings size={20} />, label: 'Settings', path: '/components/settings' }
]

const NavItem = ({ icon, label, path, active }: { icon: React.ReactNode; label: string; path: string; active?: boolean }) => {
  const router = useRouter()
  
  return (
    <button 
      onClick={() => router.push(path)}
      className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors
        ${active ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
    >
      {icon}
      <span>{label}</span>
    </button>
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

const LoadingState = () => {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[120px] w-full" />
      <Skeleton className="h-[400px] w-full" />
      <Skeleton className="h-[200px] w-full" />
    </div>
  )
}

const EmptyState = () => {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Upload className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No trades yet</h3>
        <p className="text-gray-500 text-center max-w-sm mb-4">
          Upload a CSV file of your trades to start tracking your performance
        </p>
        <Button onClick={() => document.getElementById('file-upload')?.click()}>
          Upload CSV
        </Button>
      </CardContent>
    </Card>
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
                {Math.abs(trade.quantity)} @ ${trade.price.toFixed(2)}
              </div>
              <div className="text-xs text-gray-400">
                {new Date(trade.tradeDate).toLocaleDateString()}
              </div>
            </div>
            <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm
              ${trade.gainLoss > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
            >
              {trade.gainLoss > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              ${Math.abs(trade.gainLoss).toFixed(2)}
            </div>
          </motion.div>
        ))}
      </div>
    </ScrollArea>
  )
}



const TradeAnalyzer = ({ children }: { children?: React.ReactNode }) => {

  const router = useRouter()
  const pathname = usePathname()
  
  const [trades, setTrades] = useState<Trade[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsLoading(true)
    
    try {
      const text = await file.text()
      const lines = text.split('\n').slice(2).filter(line => line.trim())
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
        }
      })
      
      setTrades(parsedTrades)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const currentPositions = useMemo(() => {
    // Group trades by symbol and calculate current holdings
    const holdings = trades.reduce((acc, trade) => {
      const quantity = trade.quantity || 0
      
      if (!acc[trade.symbol]) {
        // Initialize new symbol
        acc[trade.symbol] = {
          totalShares: quantity,
          buyCost: quantity > 0 ? quantity * trade.price : 0,
          buyShares: quantity > 0 ? quantity : 0,
          lastPrice: trade.price
        }
      } else {
        // Update existing symbol
        acc[trade.symbol].totalShares += quantity
        if (quantity > 0) {
          acc[trade.symbol].buyCost += quantity * trade.price
          acc[trade.symbol].buyShares += quantity
        }
        acc[trade.symbol].lastPrice = trade.price // Keep most recent price
      }
      
      return acc
    }, {} as Record<string, {
      totalShares: number,
      buyCost: number,
      buyShares: number,
      lastPrice: number
    }>)
  
    // Convert holdings to positions, only including symbols you currently own
    return Object.entries(holdings)
      .filter(([_, data]) => data.totalShares > 0) // Only include positive positions
      .map(([symbol, data]) => {
        const averagePrice = data.buyCost / data.buyShares
  
        return {
          symbol,
          quantity: data.totalShares,
          averagePrice: averagePrice,
          currentPrice: data.lastPrice,
          marketValue: data.totalShares * data.lastPrice,
          unrealizedPL: data.totalShares * (data.lastPrice - averagePrice),
          percentChange: ((data.lastPrice - averagePrice) / averagePrice) * 100
        }
      })
  }, [trades])


  const filteredTrades = useMemo(() => {
    const filtered = selectedDate
      ? trades.filter(t => t.tradeDate.includes(selectedDate))
      : trades
      
    if (activeTab === 'winning') {
      return filtered.filter(t => t.gainLoss > 0)
    } else if (activeTab === 'losing') {
      return filtered.filter(t => t.gainLoss < 0)
    } else {
      return filtered
    }
  }, [trades, selectedDate, activeTab])

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
      profitLoss: Math.abs(totalPL).toFixed(2),
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
    <div className="flex h-screen">
      <aside className="w-64 bg-black text-white h-screen fixed">
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <BarChart className="w-5 h-5" />
            </div>
            <span className="text-xl font-semibold">Traders Edge</span>
          </div>

          <nav className="space-y-2 flex-grow">
            {navigationItems.map((item) => (
              <NavItem 
                key={item.path}
                icon={item.icon}
                label={item.label}
                path={item.path}
                active={pathname === item.path}
              />
            ))}
          </nav>

          <div className="pt-8">
            <NavItem 
              icon={<LogOut />} 
              label="Log out" 
              path="/logout"
            />
          </div>
        </div>
      </aside>

      <main className="flex-1 bg-gray-50 ml-64 overflow-auto h-screen">
        {children || (
          <div className="p-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Trading Overview</h1>
                <p className="text-gray-500">Monitor your trading performance</p>
              </div>
              <div className="flex items-center gap-4">
                <Button variant="outline" onClick={() => document.getElementById('file-upload')?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  Import CSV
                </Button>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Avatar className="h-10 w-10">
                  <AvatarImage src="/placeholder.svg" />
                  <AvatarFallback>EM</AvatarFallback>
                </Avatar>
              </div>
            </div>

            <div className="mb-6">
              <Input
                type="month"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="max-w-xs"
              />
            </div>

            {isLoading ? (
              <LoadingState />
            ) : stats ? (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatsCard
                    title="Total Trades"
                    value={stats.total}
                    change={`${((stats.winningTrades / stats.total) * 100).toFixed(1)}% win rate`}
                    icon={<Calendar className="text-blue-500" />}
                  />
                  <StatsCard
                    title="Win Rate"
                    value={`${stats.winRate}%`}
                    change={`${stats.winningTrades} winning trades`}
                    icon={<Percent className="text-green-500" />}
                  />
                  <StatsCard
                    title={stats.profitLossLabel}
                    value={`$${stats.profitLoss}`}
                    change={stats.isProfitable ? 'Profitable' : 'Loss'}
                    trend={stats.isProfitable}
                    icon={<DollarSign className="text-yellow-500" />}
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
                        <YAxis stroke="#6B7280" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#FFF',
                            border: '1px solid #E5E7EB',
                            borderRadius: '6px' 
                          }}
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
              <EmptyState />
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default TradeAnalyzer
